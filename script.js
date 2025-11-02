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
}

function wireBuilder() {
  const base = document.getElementById("engineBase");
  if (!base) return; // not on builder page
  base.addEventListener("change", updateBuild);
  document.querySelectorAll(".upgrade").forEach(u => u.addEventListener("change", updateBuild));
  preselectFromQuery();
  updateBuild();
}

// -------- Waiver modal (builder only) --------
function wireWaiver() {
  const modal = document.getElementById("waiverModal");
  if (!modal) return; // not on builder page
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

  placeOrder.addEventListener("click", () => {
    const total = document.getElementById("totalPrice").textContent;
    const hp = document.getElementById("totalHp").textContent;
    trackEvent("orderAttempts");
    alert(`Order placed!\nTotal: $${total}\nEstimated HP: ${hp}\n(Implement payment/email later.)`);
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

// -------- Init --------
const ADMIN_USER = "admin";
const ADMIN_PASS = "revlimit";
const COUNT_API_NAMESPACE = "spx_engine_configurator";
const COUNT_API_BASE = "https://api.countapi.xyz";
const COUNT_API_TIMEOUT = 5000;
const PENDING_VISITS_KEY = "spxPendingVisits";
const PENDING_EVENTS_KEY = "spxPendingEvents";

function shouldTrackVisit() {
  const body = document.body;
  if (!body) return false;
  return body.dataset.trackVisit !== "false";
}

function formatNumber(value) {
  const numeric = Number(value) || 0;
  try {
    return numeric.toLocaleString();
  } catch (err) {
    console.warn("Unable to format number:", err);
    return String(numeric);
  }
}

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
  const data = await countApiRequest(`get/${COUNT_API_NAMESPACE}/${key}`, { allow404: true });
  if (!data) return 0;
  return data.value ?? 0;
}

async function countApiSet(key, value) {
  const data = await countApiRequest(`set/${COUNT_API_NAMESPACE}/${key}?value=${encodeURIComponent(value)}`);
  return data.value ?? value;
}

async function countApiAdd(key, amount = 1) {
  if (!amount) {
    return countApiGet(key);
  }
  const data = await countApiRequest(`hit/${COUNT_API_NAMESPACE}/${key}?amount=${encodeURIComponent(amount)}`);
  return data.value ?? amount;
}

function readPendingVisits() {
  try {
    const raw = localStorage.getItem(PENDING_VISITS_KEY);
    if (!raw) {
      return { total: 0, dates: {} };
    }
    const parsed = JSON.parse(raw);
    const total = Number(parsed.total) || 0;
    const dates = parsed.dates && typeof parsed.dates === "object" ? parsed.dates : {};
    const sanitizedDates = {};
    for (const [date, value] of Object.entries(dates)) {
      const numeric = Number(value) || 0;
      if (numeric > 0) {
        sanitizedDates[date] = numeric;
      }
    }
    return { total, dates: sanitizedDates };
  } catch (err) {
    console.warn("Unable to read pending visits from storage:", err);
    return { total: 0, dates: {} };
  }
}

function writePendingVisits(data) {
  try {
    localStorage.setItem(PENDING_VISITS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Unable to persist pending visits:", err);
  }
}

function queueVisitIncrement(date, amount = 1) {
  if (!date || amount <= 0) return;
  const pending = readPendingVisits();
  pending.total = (pending.total || 0) + amount;
  pending.dates[date] = (pending.dates[date] || 0) + amount;
  writePendingVisits(pending);
}

let visitFlushPromise = null;

function hasPendingVisits() {
  const pending = readPendingVisits();
  if ((pending.total || 0) > 0) return true;
  return Object.values(pending.dates || {}).some(value => (Number(value) || 0) > 0);
}

async function flushPendingVisits() {
  if (visitFlushPromise) {
    return visitFlushPromise;
  }

  const pending = readPendingVisits();
  const tasks = [];

  if ((pending.total || 0) > 0) {
    tasks.push(countApiAdd("visits_total", pending.total));
  }

  for (const [date, value] of Object.entries(pending.dates || {})) {
    const numeric = Number(value) || 0;
    if (numeric > 0) {
      tasks.push(countApiAdd(`visits_${date}`, numeric));
    }
  }

  if (tasks.length === 0) {
    return true;
  }

  visitFlushPromise = (async () => {
    try {
      await Promise.all(tasks);
      writePendingVisits({ total: 0, dates: {} });
      return true;
    } catch (err) {
      console.warn("Unable to flush pending visits:", err);
      return false;
    } finally {
      visitFlushPromise = null;
    }
  })();

  return visitFlushPromise;
}

function readPendingEvents() {
  try {
    const raw = localStorage.getItem(PENDING_EVENTS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch (err) {
    console.warn("Unable to read pending events from storage:", err);
    return {};
  }
}

function writePendingEvents(data) {
  try {
    localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Unable to persist pending events:", err);
  }
}

function queuePendingEvent(metricKey, amount = 1) {
  if (!metricKey || amount <= 0) return;
  const pending = readPendingEvents();
  pending[metricKey] = (Number(pending[metricKey]) || 0) + amount;
  writePendingEvents(pending);
}

let eventFlushPromise = null;

function hasPendingEvents() {
  return Object.values(readPendingEvents()).some(value => (Number(value) || 0) > 0);
}

async function flushPendingEvents() {
  if (eventFlushPromise) {
    return eventFlushPromise;
  }

  const pending = readPendingEvents();
  const entries = Object.entries(pending).filter(([, value]) => (Number(value) || 0) > 0);

  if (entries.length === 0) {
    return true;
  }

  eventFlushPromise = (async () => {
    try {
      await Promise.all(entries.map(([key, amount]) => countApiAdd(`event_${key}`, Number(amount) || 0)));
      writePendingEvents({});
      return true;
    } catch (err) {
      console.warn("Unable to flush pending events:", err);
      return false;
    } finally {
      eventFlushPromise = null;
    }
  })();

  return eventFlushPromise;
}

function recordVisit() {
  (async () => {
    try {
      await flushPendingVisits();
    } catch (err) {
      console.warn("Unable to flush visits before recording:", err);
    }

    if (!shouldTrackVisit()) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    try {
      await Promise.all([
        countApiAdd("visits_total", 1),
        countApiAdd(`visits_${today}`, 1),
      ]);
    } catch (err) {
      queueVisitIncrement(today, 1);
      console.warn("Unable to record visit count immediately; queued for retry.", err);
    }
  })();
}

function trackEvent(metricKey) {
  if (!metricKey) return;

  (async () => {
    try {
      await flushPendingEvents();
    } catch (err) {
      console.warn("Unable to flush pending events before recording:", err);
    }

    try {
      await countApiAdd(`event_${metricKey}`, 1);
    } catch (err) {
      queuePendingEvent(metricKey, 1);
      console.warn(`Unable to track metric "${metricKey}" immediately; queued for retry.`, err);
    }
  })();
}

function syncPendingAnalytics() {
  try {
    flushPendingVisits();
  } catch (err) {
    console.warn("Unable to start visit sync:", err);
  }

  try {
    flushPendingEvents();
  } catch (err) {
    console.warn("Unable to start engagement sync:", err);
  }
}

function wireAdmin() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return; // not on admin page

  const userField = document.getElementById("adminUser");
  const passField = document.getElementById("adminPass");
  const status = document.getElementById("adminStatus");
  const dashboard = document.getElementById("adminDashboard");
  const visitCount = document.getElementById("visitCount");
  const visitHistoryTable = document.getElementById("visitHistoryTable");
  const visitHistoryRows = document.getElementById("visitHistoryRows");
  const visitHistoryEmpty = document.getElementById("visitHistoryEmpty");
  const resetVisitsBtn = document.getElementById("resetVisits");
  const dashboardStatus = document.getElementById("adminDashboardStatus");
  const visitPanel = document.getElementById("visitPanel");
  const toggleVisitPanel = document.getElementById("toggleVisitPanel");
  const toggleEngagementPanel = document.getElementById("toggleEngagementPanel");
  const engagementPanel = document.getElementById("engagementPanel");
  const engagementStatus = document.getElementById("engagementStatus");
  const resetEngagementBtn = document.getElementById("resetEngagement");
  const engagementMetricsEls = {
    checkoutClicks: document.getElementById("metricCheckoutClicks"),
    orderAttempts: document.getElementById("metricOrderAttempts"),
    waiverDownloads: document.getElementById("metricWaiverDownloads"),
  };

  function setDashboardStatus(message, isError = false) {
    if (!dashboardStatus) return;
    dashboardStatus.textContent = message;
    if (isError) {
      dashboardStatus.classList.add("error");
    } else {
      dashboardStatus.classList.remove("error");
    }
  }

  async function showVisits() {
    if (!visitCount) return;
    setDashboardStatus("Loading visit data...");
    try {
      const total = await countApiGet("visits_total");
      visitCount.textContent = formatNumber(total);

      if (visitHistoryTable && visitHistoryRows && visitHistoryEmpty) {
        const dates = [];
        for (let i = 0; i < 7; i += 1) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date);
        }

        const results = await Promise.all(dates.map(date => {
          const key = `visits_${date.toISOString().slice(0, 10)}`;
          return countApiGet(key).catch(() => 0);
        }));

        const fragment = document.createDocumentFragment();
        let hasData = false;
        dates.forEach((date, index) => {
          const value = Number(results[index]) || 0;
          if (value > 0) {
            hasData = true;
          }
          const row = document.createElement("tr");
          const dateCell = document.createElement("td");
          const valueCell = document.createElement("td");
          dateCell.textContent = date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          valueCell.textContent = formatNumber(value);
          row.append(dateCell, valueCell);
          fragment.appendChild(row);
        });

        visitHistoryRows.innerHTML = "";
        visitHistoryRows.appendChild(fragment);

        if (hasData) {
          visitHistoryTable.classList.remove("hidden");
          visitHistoryEmpty.classList.add("hidden");
        } else {
          visitHistoryTable.classList.add("hidden");
          visitHistoryEmpty.classList.remove("hidden");
        }
      }
      if (hasPendingVisits()) {
        setDashboardStatus("Some visit data is queued locally and will sync once the connection returns.");
      } else {
        setDashboardStatus("");
      }
    } catch (err) {
      setDashboardStatus("Unable to load visit data.", true);
    }
  }

  function setEngagementStatus(message, isError = false) {
    if (!engagementStatus) return;
    engagementStatus.textContent = message;
    engagementStatus.classList.toggle("error", Boolean(isError));
  }

  async function showEngagement() {
    try {
      setEngagementStatus("Loading engagement metrics...");
      const entries = await Promise.all(Object.keys(engagementMetricsEls).map(key => {
        return countApiGet(`event_${key}`).catch(() => 0);
      }));

      Object.entries(engagementMetricsEls).forEach(([key, el], index) => {
        if (!el) return;
        el.textContent = formatNumber(entries[index]);
      });
      if (hasPendingEvents()) {
        setEngagementStatus("Some engagement metrics are queued locally and will sync once the connection returns.");
      } else {
        setEngagementStatus("");
      }
    } catch (err) {
      setEngagementStatus("Unable to load engagement metrics.", true);
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const user = userField.value.trim();
    const pass = passField.value;
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      status.textContent = "";
      status.classList.remove("error");
      dashboard.classList.remove("hidden");
      form.classList.add("hidden");
      passField.value = "";
      setDashboardStatus("");
      if (visitPanel) {
        visitPanel.classList.add("hidden");
      }
      if (engagementPanel) {
        engagementPanel.classList.add("hidden");
      }
      [toggleVisitPanel, toggleEngagementPanel].forEach(btn => {
        if (!btn) return;
        btn.setAttribute("aria-expanded", "false");
      });
      if (toggleVisitPanel) toggleVisitPanel.focus();
    } else {
      status.textContent = "Invalid username or password.";
      status.classList.add("error");
    }
  });

  function clearStatus() {
    status.textContent = "";
    status.classList.remove("error");
  }

  userField.addEventListener("input", clearStatus);
  passField.addEventListener("input", clearStatus);

  if (resetVisitsBtn) {
    resetVisitsBtn.addEventListener("click", async () => {
      setDashboardStatus("Resetting visit data...");
      resetVisitsBtn.disabled = true;
      try {
        await countApiSet("visits_total", 0);
        const dates = [];
        for (let i = 0; i < 14; i += 1) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().slice(0, 10));
        }
        await Promise.all(dates.map(dateKey => countApiSet(`visits_${dateKey}`, 0).catch(() => null)));
        writePendingVisits({ total: 0, dates: {} });
        await showVisits();
        setDashboardStatus("Visit counter reset.");
      } catch (err) {
        setDashboardStatus("Unable to reset visit data.", true);
      } finally {
        resetVisitsBtn.disabled = false;
      }
    });
  }

  if (resetEngagementBtn) {
    resetEngagementBtn.addEventListener("click", async () => {
      setEngagementStatus("Resetting engagement metrics...");
      resetEngagementBtn.disabled = true;
      try {
        await Promise.all(Object.keys(engagementMetricsEls).map(key => countApiSet(`event_${key}`, 0).catch(() => null)));
        writePendingEvents({});
        await showEngagement();
        setEngagementStatus("Engagement metrics reset.");
      } catch (err) {
        setEngagementStatus("Unable to reset engagement metrics.", true);
      } finally {
        resetEngagementBtn.disabled = false;
      }
    });
  }

  const panelBindings = [
    [toggleVisitPanel, visitPanel, showVisits],
    [toggleEngagementPanel, engagementPanel, showEngagement],
  ];

  panelBindings.forEach(([button, panel, onOpen]) => {
    if (!button || !panel) return;
    button.addEventListener("click", () => {
      const willOpen = panel.classList.contains("hidden");
      panelBindings.forEach(([btn, pnl]) => {
        if (!pnl) return;
        if (pnl !== panel) {
          pnl.classList.add("hidden");
        }
      });
      panelBindings.forEach(([btn]) => {
        if (!btn) return;
        btn.setAttribute("aria-expanded", btn === button && willOpen ? "true" : "false");
      });
      if (willOpen) {
        panel.classList.remove("hidden");
        if (typeof onOpen === "function") onOpen();
      } else {
        panel.classList.add("hidden");
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  syncPendingAnalytics();
  recordVisit();
  wireBuilder();
  wireWaiver();
  wireAdmin();
});
