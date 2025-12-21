import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'revlimit';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'spxengineering123@gmail.com';
const GMAIL_USER = process.env.GMAIL_USER || 'spxengineering123@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const FROM_EMAIL = process.env.FROM_EMAIL || GMAIL_USER || ADMIN_EMAIL;

const gmailTransport =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD
        }
      })
    : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use persistent database file if provided, otherwise local spx.db
const dbFile = process.env.DB_FILE || join(__dirname, 'spx.db');

const app = express();
app.use(cors());
app.use(express.json());

let db;
(async () => {
  db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });
  // Create tables if they don't exist
  await db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    subject TEXT,
    body TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.run(`CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId INTEGER,
    body TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
})();

// Basic HTTP Basic Auth middleware
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Auth required' });
  }
  const creds = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  const [user, pass] = creds;
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Auth failed' });
  }
  next();
}

async function sendEmail({ to, subject, text }) {
  if (gmailTransport) {
    await gmailTransport.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      text
    });
    return;
  }
  if (process.env.SENDGRID_API_KEY) {
    await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      text
    });
    return;
  }
  throw new Error('Email transport not configured');
}

// Endpoint to create a new message
app.post('/api/messages', async (req, res) => {
  const { name, email, subject, body } = req.body;
  if (!name || !email || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await db.run(
      'INSERT INTO messages (name, email, subject, body) VALUES (?,?,?,?)',
      [name, email, subject, body]
    );
    // Notify admin via email if API key is configured
    try {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `New contact from ${name}: ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${body}`
      });
    } catch (emailErr) {
      console.error(emailErr);
    }
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to fetch all messages (admin)
app.get('/api/messages', basicAuth, async (req, res) => {
  try {
    const messages = await db.all(
      `SELECT
        m.*,
        m.timestamp AS created_at,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM replies r
            WHERE r.messageId = m.id
          ) THEN 'answered'
          ELSE 'new'
        END AS status
      FROM messages m
      ORDER BY m.id DESC`
    );
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to fetch a single message and its replies (admin)
app.get('/api/messages/:id', basicAuth, async (req, res) => {
  try {
    const msg = await db.get(
      `SELECT
        m.*,
        m.timestamp AS created_at,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM replies r
            WHERE r.messageId = m.id
          ) THEN 'answered'
          ELSE 'new'
        END AS status
      FROM messages m
      WHERE m.id = ?`,
      [req.params.id]
    );
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const replies = await db.all(
      'SELECT *, timestamp AS created_at FROM replies WHERE messageId = ?',
      [req.params.id]
    );
    res.json({ message: msg, replies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to post a reply to a message (admin)
app.post('/api/messages/:id/reply', basicAuth, async (req, res) => {
  const { body } = req.body;
  if (!body) {
    return res.status(400).json({ error: 'Reply body is required' });
  }
  try {
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    await db.run('INSERT INTO replies (messageId, body) VALUES (?, ?)', [req.params.id, body]);
    let emailWarning = null;
    try {
      await sendEmail({
        to: msg.email,
        subject: `Re: ${msg.subject}`,
        text: body
      });
    } catch (emailErr) {
      console.error(emailErr);
      emailWarning = 'Reply stored but failed to send email';
    }
    res.json({ success: true, warning: emailWarning });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/messages/:id/replies', basicAuth, async (req, res) => {
  const { body } = req.body;
  if (!body) {
    return res.status(400).json({ error: 'Reply body is required' });
  }
  try {
    const msg = await db.get('SELECT * FROM messages WHERE id = ?', [
      req.params.id
    ]);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    await db.run('INSERT INTO replies (messageId, body) VALUES (?, ?)', [
      req.params.id,
      body
    ]);
    let emailWarning = null;
    try {
      await sendEmail({
        to: msg.email,
        subject: `Re: ${msg.subject}`,
        text: body
      });
    } catch (emailErr) {
      console.error(emailErr);
      emailWarning = 'Reply stored but failed to send email';
    }
    res.json({ success: true, warning: emailWarning });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to check admin auth without retrieving data
app.get('/api/admin/check', basicAuth, (req, res) => {
  res.json({ success: true });
});

app.post('/api/admin/check', basicAuth, (req, res) => {
  res.json({ success: true });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
