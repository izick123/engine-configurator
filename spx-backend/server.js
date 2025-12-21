import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import sgMail from "@sendgrid/mail";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 10000);

// ----------------------------
// Admin config
// ----------------------------
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// ----------------------------
// SendGrid config (REQUIRED)
// ----------------------------
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL =
  process.env.FROM_EMAIL || "SPX Engineering <no-reply@spxengineering.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

const SENDGRID_ENABLED = SENDGRID_API_KEY.startsWith("SG.");
if (SENDGRID_ENABLED) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log("✅ SendGrid enabled.");
} else {
  console.log("❌ SendGrid not enabled (missing/invalid SENDGRID_API_KEY). Emails disabled.");
}

// ----------------------------
// DB config (consider Render disk later)
// ----------------------------
const DB_PATH = process.env.DB_PATH || "spx.db";

// ----------------------------
// Middleware
// ----------------------------
app.use(express.json());

// CORS allow your site + local dev
const allowedOrigins = [
  "https://spxengineering.com",
  "https://www.spxengineering.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5500",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
  })
);

// ----------------------------
// Simple rate limit (contact form)
// ----------------------------
// 10 requests per 10 minutes per IP
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 10;
const ipHits = new Map();

function getClientIp(req) {
  // Render sets x-forwarded-for. First IP is client.
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.ip || "unknown";
}

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();

  const entry = ipHits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }

  entry.count += 1;
  ipHits.set(ip, entry);

  if (entry.count > RATE_MAX) {
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }
  next();
}

// ----------------------------
// DB init + migrations
// ----------------------------
const db = await open({
  filename: DB_PATH,
  driver: sqlite3.Database,
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    last_replied_at TEXT
  );
`);

await db.exec(`
  CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    sendgrid_message_id TEXT,
    FOREIGN KEY(message_id) REFERENCES messages(id)
  );
`);

// ----------------------------
// Email helpers (HTML + text)
// ----------------------------
function requireSendGrid() {
  if (!SENDGRID_ENABLED) throw new Error("SendGrid not configured.");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeEmailLayout({ title, preheader, contentHtml }) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader || "");
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#0f0f0f;color:#eaeaea;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safePreheader}
    </div>
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#141414;border:1px solid #2b2b2b;border-radius:14px;padding:18px;">
        <div style="font-weight:800;font-size:18px;margin-bottom:12px;">SPX Engineering</div>
        ${contentHtml}
      </div>
      <div style="color:#8a8a8a;font-size:12px;margin-top:14px;line-height:1.4;">
        This email was sent by SPX Engineering.
      </div>
    </div>
  </body>
</html>
  `.trim();
}

async function sendEmail({ to, subject, text, html, replyTo }) {
  requireSendGrid();
  if (!to) throw new Error("Missing recipient (to).");
  if (!subject) throw new Error("Missing subject.");
  if (!text) throw new Error("Missing text body.");

  const [resp] = await sgMail.send({
    to,
    from: FROM_EMAIL,
    subject,
    text,
    html: html || undefined,
    replyTo: replyTo || undefined,
  });

  // SendGrid returns headers including x-message-id sometimes
  const msgId = resp?.headers?.["x-message-id"] || resp?.headers?.["x-message-id".toLowerCase()];
  return { sendgridMessageId: msgId || null };
}

// ----------------------------
// Auth helpers (simple signed token)
// ----------------------------
function signAdminToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", ADMIN_TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyAdminToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = crypto
    .createHmac("sha256", ADMIN_TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  if (signature !== expected) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = token ? verifyAdminToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ----------------------------
// Routes
// ----------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Contact form: save message + notify admin
app.post("/api/messages", rateLimit, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const message = String(req.body?.message || "").trim();

    // Honeypot field (bots fill it). If present -> pretend success.
    const website = String(req.body?.website || "").trim();
    if (website) {
      return res.json({ ok: true });
    }

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing name, email, or message." });
    }

    const created_at = new Date().toISOString();

    const result = await db.run(
      `INSERT INTO messages (name, email, message, created_at, status) VALUES (?, ?, ?, ?, 'new')`,
      [name, email, message, created_at]
    );
    const messageId = result.lastID;

    // Notify admin (best-effort)
    (async () => {
      if (!ADMIN_EMAIL) {
        console.log("ℹ️ ADMIN_EMAIL not set; skipping admin notification email.");
        return;
      }
      if (!SENDGRID_ENABLED) {
        console.log("ℹ️ SendGrid not enabled; skipping admin notification email.");
        return;
      }

      const subject = "SPX Engineering — New Contact Message";
      const text = `New contact message\n\nFrom: ${name} <${email}>\n\n${message}\n`;

      const html = makeEmailLayout({
        title: subject,
        preheader: `New message from ${name}`,
        contentHtml: `
          <div style="font-size:14px;line-height:1.5;">
            <div style="margin-bottom:10px;"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</div>
            <div style="white-space:pre-wrap;background:#0f0f0f;border:1px solid #2b2b2b;border-radius:12px;padding:12px;">
              ${escapeHtml(message)}
            </div>
          </div>
        `,
      });

      try {
        await sendEmail({ to: ADMIN_EMAIL, subject, text, html, replyTo: email });
        console.log("✅ Admin notification email sent.");
      } catch (e) {
        console.log("❌ Admin notification error:", e?.message || e);
      }
    })();

    return res.json({ ok: true, id: messageId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error saving message." });
  }
});

// Admin login
app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not set on the server." });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = signAdminToken({ role: "admin", username, iat: Date.now() });
  return res.json({ ok: true, token });
});

// Admin list messages + status
app.get("/api/admin/messages", requireAdmin, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, name, email, message, created_at, status, last_replied_at
       FROM messages
       ORDER BY id DESC
       LIMIT 200`
    );

    // add reply counts
    const counts = await db.all(
      `SELECT message_id, COUNT(*) as cnt FROM replies GROUP BY message_id`
    );
    const map = new Map(counts.map((c) => [c.message_id, c.cnt]));

    const messages = rows.map((m) => ({
      ...m,
      reply_count: map.get(m.id) || 0,
    }));

    return res.json({ ok: true, messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error reading messages." });
  }
});

// Admin get reply history for a message
app.get("/api/admin/replies", requireAdmin, async (req, res) => {
  try {
    const messageId = Number(req.query.messageId || 0);
    if (!messageId) return res.status(400).json({ error: "Missing messageId." });

    const rows = await db.all(
      `SELECT id, message_id, to_email, subject, body, sent_at
       FROM replies
       WHERE message_id = ?
       ORDER BY id DESC`,
      [messageId]
    );

    return res.json({ ok: true, replies: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error reading replies." });
  }
});

// Admin reply to a user + store reply + update status
app.post("/api/admin/reply", requireAdmin, async (req, res) => {
  try {
    const messageId = Number(req.body?.messageId || 0);
    const to = String(req.body?.to || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const body = String(req.body?.body || "").trim();

    if (!messageId) return res.status(400).json({ error: "Missing messageId." });
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing to, subject, or body." });
    }

    const text = body;
    const html = makeEmailLayout({
      title: subject,
      preheader: "Reply from SPX Engineering",
      contentHtml: `
        <div style="font-size:14px;line-height:1.5;">
          <div style="white-space:pre-wrap;background:#0f0f0f;border:1px solid #2b2b2b;border-radius:12px;padding:12px;">
            ${escapeHtml(body)}
          </div>
        </div>
      `,
    });

    const sent_at = new Date().toISOString();

    const { sendgridMessageId } = await sendEmail({
      to,
      subject,
      text,
      html,
    });

    await db.run(
      `INSERT INTO replies (message_id, to_email, subject, body, sent_at, sendgrid_message_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [messageId, to, subject, body, sent_at, sendgridMessageId]
    );

    await db.run(
      `UPDATE messages
       SET status='replied', last_replied_at=?
       WHERE id=?`,
      [sent_at, messageId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Reply send error:", err);
    return res.status(500).json({ error: err?.message || "Failed to send reply email." });
  }
});

app.listen(PORT, () => {
  console.log(`SPX backend listening on port ${PORT}`);
});
