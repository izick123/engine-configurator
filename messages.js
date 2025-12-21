// messages.js

const API_BASE =
  (window.SPX_API_BASE && window.SPX_API_BASE.replace(/\/$/, "")) ||
  "https://spx-backend-akqu.onrender.com";

// ---- Helpers ----
async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

function setStatus(el, msg) {
  if (!el) return;
  el.textContent = msg;
}

// ---- Contact form ----
async function handleContactSubmit(e) {
  e.preventDefault();

  const statusEl = document.getElementById("status");
  setStatus(statusEl, "Sending...");

  const name = document.getElementById("name")?.value?.trim() || "";
  const email = document.getElementById("email")?.value?.trim() || "";
  const message = document.getElementById("message")?.value?.trim() || "";

  try {
    await postJSON("/api/messages", { name, email, message });
    setStatus(statusEl, "Sent ✅");
    e.target.reset();
  } catch (err) {
    console.error(err);
    setStatus(statusEl, `Error: ${err.message}`);
  }
}

// ---- Admin login ----
async function handleAdminLogin(e) {
  e.preventDefault();

  const statusEl = document.getElementById("loginStatus");
  setStatus(statusEl, "Logging in...");

  const username = document.getElementById("username")?.value?.trim() || "";
  const password = document.getElementById("password")?.value || "";

  try {
    // Backend expects Basic auth? If yours uses JSON auth, keep this postJSON.
    const data = await postJSON("/api/admin/login", { username, password });

    // If your backend returns a token, store it:
    if (data?.token) localStorage.setItem("spx_admin_token", data.token);

    setStatus(statusEl, "Logged in ✅");
    // Redirect or load admin data here if your app does that.
  } catch (err) {
    console.error(err);
    setStatus(statusEl, `Error contacting server. (${err.message})`);
  }
}

// ---- Wire up forms (only if they exist on the page) ----
document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contactForm");
  if (contactForm) contactForm.addEventListener("submit", handleContactSubmit);

  const adminForm = document.getElementById("adminLoginForm");
  if (adminForm) adminForm.addEventListener("submit", handleAdminLogin);
});
