// -------- Query param: preselect base (from landing cards) --------
function preselectFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const cc = params.get("cc"); // "198" | "212" | "224"
  if (!cc) return;
  const base = document.getElementById("engineBase");
  if (!base) return;
  for (const opt of base.options) {
    if (opt.value === cc) { opt.selected = true; break; }
  }
}

// -------- Builder math --------
function updateBuild() {
  const base = document.getElementById("engineBase");
  if (!base) return;

  let price = parseInt(base.selectedOptions[0].dataset.price, 10);
  let hp    = parseInt(base.selectedOptions[0].dataset.hp, 10);

  document.querySelectorAll(".upgrade").forEach(u => {
    if (u.checked) {
      price += parseInt(u.dataset.price, 10);
      hp    += parseInt(u.dataset.hp, 10);
    }
  });

  document.getElementById("totalPrice").textContent = price;
  document.getElementById("totalHp").textContent = hp;

  // Update horsepower progress bar
  const hpProgressEl = document.getElementById("hpProgress");
  if (hpProgressEl && window.MAX_HP) {
    const percent = Math.min((hp / window.MAX_HP) * 100, 100);
    hpProgressEl.style.width = `${percent}%`;
  }
  // Update selected upgrades summary list
  const summaryList = document.getElementById("summaryList");
  if (summaryList) {
    summaryList.innerHTML = "";
    const selected = [];
    document.querySelectorAll(".upgrade").forEach(up => {
      if (up.checked) {
        const priceVal = Number(up.dataset.price) || 0;
        const hpVal = Number(up.dataset.hp) || 0;
        if (priceVal <= 0 && hpVal <= 0) return;
        const label = up.parentElement ? up.parentElement.textContent.trim() : null;
        if (label) selected.push(label);
      }
    });
    if (selected.length > 0) {
      selected.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        summaryList.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No upgrades selected.";
      summaryList.appendChild(li);
    }
  }
}

function wireBuilder() {
  const base = document.getElementById("engineBase");
  if (!base) return;
  base.addEventListener("change", updateBuild);
  document.querySelectorAll(".upgrade").forEach(u => u.addEventListener("change", updateBuild));
  preselectFromQuery();
  window.MAX_HP = computeMaxHp();
  updateBuild();
}

// -------- Waiver modal (builder only) --------
function wireWaiver() {
  const modal = document.getElementById("waiverModal");
  if (!modal) return;
  const checkoutBtn = document.getElementById("checkoutBtn");
  const closeModal  = document.getElementById("closeModal");
  const agreeBox    = document.getElementById("agreeBox");
  const placeOrder  = document.getElementById("placeOrder");
  const downloadBtn = document.getElementById("downloadWaiver");

  checkoutBtn.addEventListener("click", () => {
    trackEvent("checkoutClicks");
    modal.setAttribute("aria-hidden", "false");
    agreeBox.checked = false;
    placeOrder.disabled = true;
  });
  closeModal.addEventListener("click", () => modal.setAttribute("aria-hidden", "true"));
  agreeBox.addEventListener("change", () => placeOrder.disabled = !agreeBox.checked);

  // When confirming an order, ask for email and send to mailing list
  placeOrder.addEventListener("click", () => {
    trackEvent("orderAttempts");
    const email = prompt(
      "Sorry, we are not taking orders currently.\nPlease enter your email to stay up to date with SPX news:"
    );
    if (email && email.includes("@")) {
      const subject = encodeURIComponent("SPX Mailing List");
      const body = encodeURIComponent(
        `Hello SPX Engineering team,%0D%0A%0D%0AI would like to be added to your mailing list.%0D%0AMy email: ${email}%0D%0A%0D%0AThank you!`
      );
      window.location.href = `mailto:spxengineering123@gmail.com?subject=${subject}&body=${body}`;
    }
    modal.setAttribute("aria-hidden", "true");
  });

  downloadBtn.addEventListener("click", () => {
    trackEvent("waiverDownloads");
    const text = `
SPX Engineering — Racing Use Waiver & Terms

1) Racing/off-road use only.
2) High-performance engines may require expert installation/tuning.
3) No liability for damage, injury, or death arising from use or misuse.
4) Warranty void once sealed components are opened or unit is operated.
5) Horsepower figures are estimates and may vary.

Customer Name: _________________________
Signature:     _________________________
Date:          _________________________
`.trim();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "SPX-Waiver.txt" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
}

// -------- Analytics & storage helpers (CounterAPI & local storage) --------
const ADMIN_USER = "admin";
const ADMIN_PASS = "revlimit";
const COUNT_API_NAMESPACE = "spx_engine_configurator";
const COUNT_API_BASE = "https://api.counterapi.dev/v1";
const COUNT_API_TIMEOUT = 5000;
const PENDING_VISITS_KEY = "spxPendingVisits";
const PENDING_EVENTS_KEY = "spxPendingEvents";
const LOCAL_ANALYTICS_KEY = "spxLocalAnalytics";

function computeMaxHp() {
  const baseSelect = document.getElementById("engineBase");
  if (!baseSelect) return 0;
  let maxHp = 0;
  baseSelect.querySelectorAll("option").forEach(opt => {
    const baseHp = Number(opt.dataset.hp) || 0;
    if (baseHp > maxHp) maxHp = baseHp;
  });
  const radioGroupMax = {};
  document.querySelectorAll(".upgrade").forEach(up => {
    const group = up.dataset.group;
    const hp = Number(up.dataset.hp) || 0;
    if (!group) return;
    if (up.type === "radio") {
      if (!radioGroupMax[group] || hp > radioGroupMax[group]) {
        radioGroupMax[group] = hp;
      }
    }
  });
  Object.values(radioGroupMax).forEach(val => {
    maxHp += val;
  });
  document.querySelectorAll(".upgrade").forEach(up => {
    const hp = Number(up.dataset.hp) || 0;
    if (up.type !== "radio") {
      maxHp += hp;
    }
  });
  return maxHp;
}

// Utility to format numbers with commas
function formatNumber(value) {
  const numeric = Number(value) || 0;
  try {
    return numeric.toLocaleString();
  } catch {
    return String(numeric);
  }
}

// CounterAPI helpers
async function countApiRequest(path, { method = "GET", signal, allow404 = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COUNT_API_TIMEOUT);
  try {
    const response = await fetch(`${COUNT_API_BASE}/${path}`, {
      method,
      signal: signal || controller.signal,
    });
    if (!response.ok) {
      if (allow404 && response.status === 404) {
        return null;
      }
      const error = new Error(`Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function countApiGet(key) {
  const data = await countApiRequest(`${COUNT_API_NAMESPACE}/${key}`, { allow404: true });
  if (!data || typeof data.count === "undefined") return 0;
  return data.count;
}

async function countApiSet(key, value) {
  const data = await countApiRequest(`${COUNT_API_NAMESPACE}/${key}/set?count=${encodeURIComponent(value)}`);
  if (!data || typeof data.count === "undefined") return value;
  return data.count;
}

async function countApiAdd(key, amount = 1) {
  if (!amount) {
    return countApiGet(key);
  }
  let current;
  try {
    current = await countApiGet(key);
  } catch {
    current = 0;
  }
  const newValue = (Number(current) || 0) + amount;
  await countApiSet(key, newValue);
  return newValue;
}

/* local storage helpers for analytics omitted here for brevity */
/* admin logic, theme toggling, faq accordion, F1 inquiry, etc. continue... */

// -------- F1 page inquiry --------
function wireF1() {
  const btn = document.getElementById("inquireBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const email = prompt(
      "Sorry, we are not taking orders currently.\nPlease enter your email to stay up to date with SPX news:"
    );
    if (email && email.includes("@")) {
      const subject = encodeURIComponent("F1 Series Kart Inquiry");
      const body = encodeURIComponent(
        `Hello SPX Engineering team,%0D%0A%0D%0AI would like to be added to your F1 series mailing list.%0D%0AMy email: ${email}%0D%0A%0D%0AThank you!`
      );
      window.location.href = `mailto:spxengineering123@gmail.com?subject=${subject}&body=${body}`;
    }
  });
}

// -------- Theme toggling (light/dark) --------
function setTheme(theme) {
  const root = document.documentElement;
  if (!root) return;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.setAttribute("data-theme", "dark");
  }
  try {
    localStorage.setItem("spxTheme", theme);
  } catch {}
}
function toggleTheme() {
  const current = (() => {
    try {
      return localStorage.getItem("spxTheme") || "dark";
    } catch {
      return "dark";
    }
  })();
  setTheme(current === "light" ? "dark" : "light");
}
function wireThemeToggle() {
  const toggleBtn = document.getElementById("themeToggle");
  try {
    const saved = localStorage.getItem("spxTheme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  } catch {}
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      toggleTheme();
    });
  }
}

// -------- FAQ accordion --------
function wireFaq() {
  const items = document.querySelectorAll(".faq-item");
  if (!items) return;
  items.forEach(item => {
    const header = item.querySelector("h3");
    const content = item.querySelector("p");
    if (!header || !content) return;
    if (!content.classList.contains("hidden")) {
      content.classList.add("hidden");
    }
    header.setAttribute("tabindex", "0");
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", "false");
    function toggle() {
      const isHidden = content.classList.toggle("hidden");
      header.setAttribute("aria-expanded", String(!isHidden));
    }
    header.addEventListener("click", toggle);
    header.addEventListener("keypress", e => {
      if (e.key === "Enter" || e.key === " ") {
        toggle();
        e.preventDefault();
      }
    });
  });
}

// -------- Document ready --------
document.addEventListener("DOMContentLoaded", () => {
  // sync pending analytics, record page visit, and wire up page-specific modules
  // (Implementation of these helpers continues in file)
  syncPendingAnalytics();
  recordVisit();
  wireBuilder();
  wireWaiver();
  wireAdmin();
  wireThemeToggle();
  wireFaq();
  wireF1();
});

