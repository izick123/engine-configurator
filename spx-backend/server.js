import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import crypto from "crypto";

import sqlite3 from "sqlite3";
import { open } from "sqlite";

dotenv.config();

const app = express();

// ----------------------------
// Config
// ----------------------------
const PORT = Number(process.env.PORT || 10000);

// Admin credentials (set in Render env vars)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ""; // SET THIS IN RENDER
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

// Email settings:
// Prefer SMTP_* if provided, otherwise use Gmail vars.
// (Render env vars can use either set.)
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "";
const FROM_EMAIL = process.env.SMTP_FROM || process.env.FROM_EMAIL || SMTP_USER || "no-reply@spxengineering.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || SMTP_USER || "";

// SQLite path
const DB_PATH = process.env.DB_PATH || "spx.db";

// ----------------------------
// Middleware
// ----------------------------
app.use(express.json());

// CORS: allow your site + localhost
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
      // allow server-to-server, curl, or no-origin requests
      if (!origin) return cb(null, true);
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
// Email init
// ----------------------------
function getTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendEmailNotification({ name, email, message }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log("Email not configured: missing SMTP_USER/SMTP_PASS (or GMAIL_USER/GMAIL_APP_PASSWORD).");
    return { sent: false, reason: "Email not configured" };
  }

  const subject = `New SPX Contact Message from ${name}`;
  const text = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n`;

  const to = ADMIN_EMAIL || SMTP_USER;
  if (!to) return { sent: false, reason: "No admin email configured" };

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    replyTo: email,
    subject,
    text,
  });

  return { sent: true };
}

// ----------------------------
// Auth helpers
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

  if (!payload || payload?.role !== "admin") {
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

    // Send email notification (don’t block the request on email)
    sendEmailNotification({ name, email, message })
      .then((r) => console.log("Email result:", r))
      .catch((e) => console.log("Email send error:", e?.message || e));

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error saving message." });
  }
});

// Admin login (returns token)
app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not set on the server." });
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
    const rows = await db.all(`SELECT id, name, email, message, created_at FROM messages ORDER BY id DESC LIMIT 200`);
    return res.json({ ok: true, messages: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error reading messages." });
  }
});
// Admin reply to a message (send email back to the user)
app.post("/api/admin/reply", requireAdmin, async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const body = String(req.body?.body || "").trim();

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing to, subject, or body." });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(500).json({
        error: "Email not configured on server (missing SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD).",
      });
    }

    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text: body,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send reply email." });
  }
});

// ----------------------------
// Start
// ----------------------------
app.listen(PORT, () => {
  console.log(`SPX backend listening on port ${PORT}`);
});
