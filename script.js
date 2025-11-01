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
const VISIT_STORAGE_KEY = "spxVisitCount";
const VISIT_HISTORY_KEY = "spxVisitHistory";
const ENGAGEMENT_STORAGE_KEY = "spxEngagementMetrics";
const ADMIN_USER = "admin";
const ADMIN_PASS = "revlimit";

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : fallback;
  } catch (err) {
    console.warn(`Unable to parse storage key "${key}":`, err);
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Unable to persist storage key "${key}":`, err);
  }
}

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

function getVisitCount() {
  const stored = localStorage.getItem(VISIT_STORAGE_KEY);
  const parsed = stored ? parseInt(stored, 10) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getVisitHistory() {
  return readJsonStorage(VISIT_HISTORY_KEY, {});
}

function saveVisitHistory(history) {
  writeJsonStorage(VISIT_HISTORY_KEY, history);
}

function recordVisit() {
  if (!shouldTrackVisit()) return;
  const count = getVisitCount();
  localStorage.setItem(VISIT_STORAGE_KEY, String(count + 1));

  const history = getVisitHistory();
  const today = new Date().toISOString().slice(0, 10);
  history[today] = (history[today] || 0) + 1;
  saveVisitHistory(history);
}

function getEngagementMetrics() {
  return readJsonStorage(ENGAGEMENT_STORAGE_KEY, {});
}

function saveEngagementMetrics(metrics) {
  writeJsonStorage(ENGAGEMENT_STORAGE_KEY, metrics);
}

function trackEvent(metricKey) {
  if (!metricKey) return;
  const metrics = getEngagementMetrics();
  metrics[metricKey] = (metrics[metricKey] || 0) + 1;
  saveEngagementMetrics(metrics);
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

  function showVisits() {
    if (!visitCount) return;
    try {
      visitCount.textContent = formatNumber(getVisitCount());
      if (visitHistoryTable && visitHistoryRows && visitHistoryEmpty) {
        const history = getVisitHistory();
        const entries = Object.entries(history)
          .map(([date, value]) => ({ date, value: Number(value) || 0 }))
          .sort((a, b) => (a.date < b.date ? 1 : -1));

        if (entries.length === 0) {
          visitHistoryRows.innerHTML = "";
          visitHistoryEmpty.classList.remove("hidden");
          visitHistoryTable.classList.add("hidden");
        } else {
          visitHistoryEmpty.classList.add("hidden");
          visitHistoryTable.classList.remove("hidden");
          const fragment = document.createDocumentFragment();
          entries.slice(0, 7).forEach(({ date, value }) => {
            const row = document.createElement("tr");
            const dateCell = document.createElement("td");
            const valueCell = document.createElement("td");
            const dateObj = new Date(date);
            if (!Number.isNaN(dateObj.getTime())) {
              dateCell.textContent = dateObj.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            } else {
              dateCell.textContent = date;
            }
            valueCell.textContent = formatNumber(value);
            row.append(dateCell, valueCell);
            fragment.appendChild(row);
          });
          visitHistoryRows.innerHTML = "";
          visitHistoryRows.appendChild(fragment);
        }
      }
      setDashboardStatus("");
    } catch (err) {
      setDashboardStatus("Unable to load visit data.", true);
    }
  }

  function setEngagementStatus(message, isError = false) {
    if (!engagementStatus) return;
    engagementStatus.textContent = message;
    engagementStatus.classList.toggle("error", Boolean(isError));
  }

  function showEngagement() {
    try {
      const metrics = getEngagementMetrics();
      Object.entries(engagementMetricsEls).forEach(([key, el]) => {
        if (!el) return;
        const value = metrics[key] || 0;
        el.textContent = formatNumber(value);
      });
      setEngagementStatus("");
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
    resetVisitsBtn.addEventListener("click", () => {
      try {
        localStorage.setItem(VISIT_STORAGE_KEY, "0");
        saveVisitHistory({});
        showVisits();
        setDashboardStatus("Visit counter reset.");
      } catch (err) {
        setDashboardStatus("Unable to reset visit data.", true);
      }
    });
  }

  if (resetEngagementBtn) {
    resetEngagementBtn.addEventListener("click", () => {
      try {
        saveEngagementMetrics({});
        showEngagement();
        setEngagementStatus("Engagement metrics reset.");
      } catch (err) {
        setEngagementStatus("Unable to reset engagement metrics.", true);
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
  try { recordVisit(); } catch (err) {
    console.warn("Unable to record visit count:", err);
  }
  wireBuilder();
  wireWaiver();
  wireAdmin();
});
