import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

import sgMail from "@sendgrid/mail";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 10000);

// ----------------------------
// Admin config (Render env vars)
// ----------------------------
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""; // MUST be set in Render
const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// ----------------------------
// Email config
// Prefer SendGrid (recommended on Render), fallback to SMTP if needed
// ----------------------------
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";

// FROM_EMAIL should be a verified sender if using SendGrid
// Example: "SPX Engineering <spxengineering123@gmail.com>" (if verified)
// Better long-term: "SPX Engineering <support@spxengineering.com>" (domain verified)
const FROM_EMAIL =
  process.env.FROM_EMAIL ||
  process.env.SMTP_FROM ||
  process.env.SMTP_USER ||
  process.env.GMAIL_USER ||
  "no-reply@spxengineering.com";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

// SMTP fallback envs (only used if SendGrid not configured)
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";

// Enable SendGrid only if key looks valid
const SENDGRID_ENABLED = SENDGRID_API_KEY.startsWith("SG.");
if (SENDGRID_ENABLED) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log("✅ SendGrid enabled.");
} else {
  console.log("ℹ️ SendGrid not enabled (missing/invalid SENDGRID_API_KEY).");
}

// ----------------------------
// DB config
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
      if (!origin) return cb(null, true); // allow curl/server-to-server
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
  })
);

// ----------------------------
// DB init
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
    created_at TEXT NOT NULL
  );
`);

// ----------------------------
// Email helpers
// ----------------------------
function getSmtpTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },

    // Keep timeouts so requests never hang forever
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 12000,
  });
}

async function sendEmail({ to, subject, text, replyTo }) {
  if (!to) throw new Error("Missing recipient email (to).");
  if (!subject) throw new Error("Missing email subject.");
  if (!text) throw new Error("Missing email body.");

  // Prefer SendGrid
  if (SENDGRID_ENABLED) {
    await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      text,
      replyTo: replyTo || undefined,
    });
    return;
  }

  // SMTP fallback (may fail on Render due to outbound SMTP blocking)
  const transporter = getSmtpTransporter();
  if (!transporter) {
    throw new Error(
      "Email not configured. Set SENDGRID_API_KEY (recommended) or SMTP_USER/SMTP_PASS."
    );
  }

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    replyTo: replyTo || undefined,
  });
}

async function sendAdminNotification({ name, email, message }) {
  const to = ADMIN_EMAIL;
  if (!to) {
    console.log("ℹ️ ADMIN_EMAIL not set; skipping admin notification email.");
    return;
  }

  await sendEmail({
    to,
    subject: `New SPX Contact Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n`,
    replyTo: email,
  });
}

// ----------------------------
// Token helpers (simple signed token)
// ----------------------------
function signAdminToken(payload) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");

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

// Contact: save message + notify admin
app.post("/api/messages", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing name, email, or message." });
    }

    const created_at = new Date().toISOString();

    await db.run(
      `INSERT INTO messages (name, email, message, created_at) VALUES (?, ?, ?, ?)`,
      [name, email, message, created_at]
    );

    // Fire-and-forget notification
    sendAdminNotification({ name, email, message })
      .then(() => console.log("✅ Admin notification email sent."))
      .catch((e) =>
        console.log("❌ Admin notification error:", e?.message || e)
      );

    return res.json({ ok: true });
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
    return res
      .status(500)
      .json({ error: "ADMIN_PASSWORD is not set on the server." });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = signAdminToken({
    role: "admin",
    username,
    iat: Date.now(),
  });

  return res.json({ ok: true, token });
});

// Admin list messages
app.get("/api/admin/messages", requireAdmin, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, name, email, message, created_at
       FROM messages
       ORDER BY id DESC
       LIMIT 200`
    );

    return res.json({ ok: true, messages: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error reading messages." });
  }
});

// Admin reply to a user
app.post("/api/admin/reply", requireAdmin, async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const body = String(req.body?.body || "").trim();

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing to, subject, or body." });
    }

    await sendEmail({ to, subject, text: body });
    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Reply send error:", err);
    return res
      .status(500)
      .json({ error: err?.message || "Failed to send reply email." });
  }
});

// ----------------------------
// Start
// ----------------------------
app.listen(PORT, () => {
  console.log(`SPX backend listening on port ${PORT}`);
});
