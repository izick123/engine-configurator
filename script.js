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

async function countApiHit(key) {
  const data = await countApiRequest(`hit/${COUNT_API_NAMESPACE}/${key}`);
  return data.value ?? 0;
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

async function recordVisit() {
  if (!shouldTrackVisit()) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await Promise.all([
      countApiHit("visits_total"),
      countApiHit(`visits_${today}`),
    ]);
  } catch (err) {
    console.warn("Unable to record visit count:", err);
  }
}

async function trackEvent(metricKey) {
  if (!metricKey) return;
  try {
    await countApiHit(`event_${metricKey}`);
  } catch (err) {
    console.warn(`Unable to track metric "${metricKey}":`, err);
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
  recordVisit();
  wireBuilder();
  wireWaiver();
  wireAdmin();
});
