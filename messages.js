// Set this to your backend URL.
const API_BASE_URL = "https://spx-backend-nunl.onrender.com";
// When you deploy backend to Render or similar, change it to that URL.
// Reusable helper so any page can send a message to the backend.
async function sendMessageToBackend({ name, email, subject, body }) {
  const payload = { name, email, subject, body };

  const res = await fetch(`${API_BASE_URL}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // ignore JSON parse errors
  }

  if (!res.ok) {
    throw new Error(data.error || "Error sending message");
  }

  return data;
}

// ----------------------
// Admin auth handling
// ----------------------
let adminAuthHeader = null;

function makeAuthHeader(user, pass) {
  const token = btoa(`${user}:${pass}`);
  return `Basic ${user}:${pass}` ? `Basic ${token}` : null;
}

// Small helper for fetch+JSON
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "API error");
  }
  return data;
}

// ----------------------
// SITE VISIT COUNTER
// ----------------------
function incrementVisitCounter() {
  try {
    const key = "spx_visit_count";
    const current = Number(localStorage.getItem(key) || "0");
    const next = current + 1;
    localStorage.setItem(key, String(next));
  } catch (_) {
    // ignore
  }
}

function renderVisitCount() {
  try {
    const key = "spx_visit_count";
    const count = Number(localStorage.getItem(key) || "0");
    const el = document.getElementById("siteVisitCount");
    if (el) el.textContent = String(count);
  } catch (_) {}
}

// ----------------------
// CONTACT FORM
// ----------------------
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const nameInput = document.getElementById("contactName");
  const emailInput = document.getElementById("contactEmail");
  const subjectInput = document.getElementById("contactSubject");
  const messageInput = document.getElementById("contactMessage");
  const statusEl = document.getElementById("contactStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (statusEl) statusEl.textContent = "";

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const subject = subjectInput.value.trim();
    const body = messageInput.value.trim();

    if (!name || !email || !subject || !body) {
      if (statusEl) statusEl.textContent = "Please fill out all fields.";
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, body })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error sending message");
      }

      form.reset();
      if (statusEl)
        statusEl.textContent =
          "Message sent! We'll get back to you via email.";
    } catch (err) {
      console.error(err);
      if (statusEl)
        statusEl.textContent =
          "Something went wrong. Please try again later.";
    }
  });
}

// ----------------------
// ADMIN LOGIN
// ----------------------
function initAdminLogin() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;

  const userInput = document.getElementById("adminUser");
  const passInput = document.getElementById("adminPass");
  const statusEl = document.getElementById("adminStatus");
  const dashboard = document.getElementById("adminDashboard");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (statusEl) statusEl.textContent = "";

    const user = userInput.value.trim();
    const pass = passInput.value;

    if (!user || !pass) {
      if (statusEl) statusEl.textContent = "Enter username and password.";
      return;
    }

    const header = makeAuthHeader(user, pass);

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/check`, {
        headers: { Authorization: header }
      });

      if (!res.ok) {
        if (statusEl) statusEl.textContent = "Login failed.";
        return;
      }

      adminAuthHeader = header;
      form.classList.add("hidden");
      if (dashboard) dashboard.classList.remove("hidden");

      initAdminMessages();
      initAdminMetrics();
      renderMessageList();
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = "Error contacting server.";
    }
  });
}

// ----------------------
// ADMIN MESSAGES UI
// ----------------------
let currentMessageId = null;

async function renderMessageList() {
  const listEl = document.getElementById("messageList");
  if (!listEl || !adminAuthHeader) return;

  listEl.innerHTML = "<li class='small muted'>Loading…</li>";

  try {
    const messages = await fetchJSON(`${API_BASE_URL}/api/messages`, {
      headers: { Authorization: adminAuthHeader }
    });

    listEl.innerHTML = "";

    if (!messages.length) {
      const li = document.createElement("li");
      li.textContent = "No messages yet.";
      li.className = "small muted";
      listEl.appendChild(li);
      showMessageDetail(null);
      return;
    }

    messages.forEach((msg) => {
      const li = document.createElement("li");
      li.className = "message-item";
      li.dataset.id = msg.id;
      li.innerHTML = `
        <div class="msg-name">
          ${msg.name}
          <span class="small muted">&lt;${msg.email}&gt;</span>
        </div>
        <div class="msg-subject small">${msg.subject}</div>
        <div class="msg-date small muted">
          ${new Date(msg.created_at).toLocaleString()} • ${msg.status}
        </div>
      `;
      li.addEventListener("click", () => {
        currentMessageId = msg.id;
        loadMessageDetail(msg.id);
      });
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML =
      "<li class='small muted'>Failed to load messages.</li>";
  }
}

function showMessageDetail(empty) {
  const metaEl = document.getElementById("messageMeta");
  const bodyEl = document.getElementById("messageBody");
  const repliesEl = document.getElementById("messageReplies");
  const emptyHint = document.getElementById("messageEmptyHint");
  const replyForm = document.getElementById("replyForm");

  if (!metaEl || !bodyEl || !repliesEl || !emptyHint || !replyForm) return;

  if (empty) {
    emptyHint.classList.remove("hidden");
    metaEl.innerHTML = "";
    bodyEl.textContent = "";
    repliesEl.innerHTML = "";
    replyForm.classList.add("hidden");
  } else {
    emptyHint.classList.add("hidden");
    replyForm.classList.remove("hidden");
  }
}

async function loadMessageDetail(id) {
  const metaEl = document.getElementById("messageMeta");
  const bodyEl = document.getElementById("messageBody");
  const repliesEl = document.getElementById("messageReplies");
  const replyText = document.getElementById("replyText");

  if (!metaEl || !bodyEl || !repliesEl || !replyText) return;

  if (!id) {
    showMessageDetail(true);
    return;
  }

  try {
    const data = await fetchJSON(`${API_BASE_URL}/api/messages/${id}`, {
      headers: { Authorization: adminAuthHeader }
    });

    const msg = data.message;
    const replies = data.replies || [];

    showMessageDetail(false);

    metaEl.innerHTML = `
      <div><strong>${msg.subject}</strong></div>
      <div class="small">${msg.name} &lt;${msg.email}&gt;</div>
      <div class="small muted">${new Date(
        msg.created_at
      ).toLocaleString()}</div>
    `;
    bodyEl.textContent = msg.body;

    repliesEl.innerHTML = "";
    replies.forEach((r) => {
      const div = document.createElement("div");
      div.className = "reply-item small";
      div.innerHTML = `
        <div class="reply-date">${new Date(
          r.created_at
        ).toLocaleString()}</div>
        <div class="reply-body">${r.body}</div>
      `;
      repliesEl.appendChild(div);
    });

    replyText.value = "";
  } catch (err) {
    console.error(err);
  }
}

function initAdminMessages() {
  const replyForm = document.getElementById("replyForm");
  const replyText = document.getElementById("replyText");

  if (!replyForm || !replyText) return;

  replyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentMessageId || !adminAuthHeader) return;

    const body = replyText.value.trim();
    if (!body) return;

    try {
      await fetchJSON(
        `${API_BASE_URL}/api/messages/${currentMessageId}/replies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: adminAuthHeader
          },
          body: JSON.stringify({ body })
        }
      );

      replyText.value = "";
      await loadMessageDetail(currentMessageId);
      await renderMessageList();
    } catch (err) {
      console.error(err);
      alert("Failed to send reply: " + err.message);
    }
  });
}

// ----------------------
// ADMIN METRICS
// ----------------------
function initAdminMetrics() {
  renderVisitCount();

  const btn = document.getElementById("metricsButton");
  const out = document.getElementById("metricsOutput");
  if (!btn || !out) return;

  btn.addEventListener("click", async () => {
    out.textContent = "Loading metrics…";

    try {
      const messages = await fetchJSON(`${API_BASE_URL}/api/messages`, {
        headers: { Authorization: adminAuthHeader }
      });

      const total = messages.length;
      const answered = messages.filter((m) => m.status === "answered").length;
      const pending = messages.filter((m) => m.status === "new").length;
      const last =
        total > 0
          ? new Date(messages[0].created_at).toLocaleString()
          : "n/a";

      const visitCountEl = document.getElementById("siteVisitCount");
      const visits = visitCountEl ? visitCountEl.textContent : "0";

      out.textContent =
        `Total messages: ${total}\n` +
        `Answered: ${answered}\n` +
        `Pending: ${pending}\n` +
        `Last message: ${last}\n\n` +
        `Local site visits (this browser): ${visits}`;
    } catch (err) {
      console.error(err);
      out.textContent = "Failed to load metrics.";
    }
  });
}

// ----------------------
// GLOBAL INIT
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  incrementVisitCounter();
  renderVisitCount();
  initContactForm();
  initAdminLogin();
});
