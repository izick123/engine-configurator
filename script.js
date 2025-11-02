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
        // Skip zero-cost upgrades that do not affect performance (e.g. stock options)
        if (priceVal <= 0 && hpVal <= 0) return;
        // Use the parent label text as the name
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
  if (!base) return; // not on builder page
  base.addEventListener("change", updateBuild);
  document.querySelectorAll(".upgrade").forEach(u => u.addEventListener("change", updateBuild));
  // Preselect base from query string
  preselectFromQuery();
  // Compute maximum horsepower for scaling progress bar once on load
  window.MAX_HP = computeMaxHp();
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
// Replace CountAPI with CounterAPI (v1) since CountAPI is no longer available.
// CounterAPI v1 endpoints:
//   Increment (up):  https://api.counterapi.dev/v1/:namespace/:name/up
//   Get current:    https://api.counterapi.dev/v1/:namespace/:name
//   Set count:      https://api.counterapi.dev/v1/:namespace/:name/set?count=<value>
//   List counts:    https://api.counterapi.dev/v1/:namespace/:name/list?group_by=day&order_by=desc
const COUNT_API_BASE = "https://api.counterapi.dev/v1";
const COUNT_API_TIMEOUT = 5000;
const PENDING_VISITS_KEY = "spxPendingVisits";
const PENDING_EVENTS_KEY = "spxPendingEvents";
const LOCAL_ANALYTICS_KEY = "spxLocalAnalytics";
// The legacy CountAPI required key creation. CounterAPI automatically creates
// counters when you read or set them, so we don't need to cache keys.

// -------- Performance helper --------
// Compute the maximum achievable horsepower for scaling the progress bar.
// This considers the highest base HP across engine options, the maximum HP
// contribution of each radio-group of upgrades (e.g. carb, cam), and the
// sum of all checkbox upgrades (since checkboxes can be combined).
function computeMaxHp() {
  const baseSelect = document.getElementById("engineBase");
  if (!baseSelect) return 0;
  // Determine highest base horsepower
  let maxHp = 0;
  baseSelect.querySelectorAll("option").forEach(opt => {
    const baseHp = Number(opt.dataset.hp) || 0;
    if (baseHp > maxHp) maxHp = baseHp;
  });
  // Map of radio group -> max hp in that group
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
  // Sum the highest hp per radio group
  Object.values(radioGroupMax).forEach(val => {
    maxHp += val;
  });
  // Sum all checkbox hp (they can all be selected)
  document.querySelectorAll(".upgrade").forEach(up => {
    const hp = Number(up.dataset.hp) || 0;
    if (up.type !== "radio") {
      maxHp += hp;
    }
  });
  return maxHp;
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

/**
 * Retrieve the current value of a counter.
 * CounterAPI returns an object with a `count` property.
 */
async function countApiGet(key) {
  const data = await countApiRequest(`${COUNT_API_NAMESPACE}/${key}`, { allow404: true });
  if (!data || typeof data.count === "undefined") return 0;
  return data.count;
}

/**
 * Set a counter to a specific value. CounterAPI allows setting counts via
 * the `/set` endpoint. The API returns an object with the new `count` value.
 */
async function countApiSet(key, value) {
  const data = await countApiRequest(`${COUNT_API_NAMESPACE}/${key}/set?count=${encodeURIComponent(value)}`);
  if (!data || typeof data.count === "undefined") return value;
  return data.count;
}

/**
 * Add to a counter. CounterAPI V1 does not support atomic increments by arbitrary
 * amounts, so we read the current count and then set it to (current + amount).
 * If amount is 0, simply return the current count.
 */
async function countApiAdd(key, amount = 1) {
  if (!amount) {
    return countApiGet(key);
  }
  // Fetch current value
  let current;
  try {
    current = await countApiGet(key);
  } catch (err) {
    current = 0;
  }
  const newValue = (Number(current) || 0) + amount;
  await countApiSet(key, newValue);
  return newValue;
}

function readLocalAnalytics() {
  try {
    const raw = localStorage.getItem(LOCAL_ANALYTICS_KEY);
    if (!raw) {
      return { visits: { total: 0, dates: {} }, events: {} };
    }
    const parsed = JSON.parse(raw);
    const visits = parsed && typeof parsed === "object" ? parsed.visits : {};
    const events = parsed && typeof parsed === "object" ? parsed.events : {};
    const sanitizedDates = {};
    if (visits && typeof visits === "object" && visits.dates) {
      for (const [date, value] of Object.entries(visits.dates)) {
        const numeric = Number(value) || 0;
        if (numeric > 0) {
          sanitizedDates[date] = numeric;
        }
      }
    }
    const visitTotal = visits && typeof visits.total !== "undefined" ? Number(visits.total) : 0;
    return {
      visits: {
        total: Number.isNaN(visitTotal) ? 0 : visitTotal,
        dates: sanitizedDates,
      },
      events: Object.entries(events || {}).reduce((acc, [key, value]) => {
        const numeric = Number(value) || 0;
        if (numeric > 0) {
          acc[key] = numeric;
        }
        return acc;
      }, {}),
    };
  } catch (err) {
    console.warn("Unable to read local analytics snapshot:", err);
    return { visits: { total: 0, dates: {} }, events: {} };
  }
}

function writeLocalAnalytics(data) {
  try {
    localStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Unable to persist local analytics snapshot:", err);
  }
}

function recordLocalVisit(date, amount = 1) {
  if (!date || amount <= 0) return;
  const snapshot = readLocalAnalytics();
  if (!snapshot.visits || typeof snapshot.visits !== "object") {
    snapshot.visits = { total: 0, dates: {} };
  }
  if (!snapshot.visits.dates || typeof snapshot.visits.dates !== "object") {
    snapshot.visits.dates = {};
  }
  snapshot.visits.total = (snapshot.visits.total || 0) + amount;
  snapshot.visits.dates[date] = (snapshot.visits.dates[date] || 0) + amount;
  writeLocalAnalytics(snapshot);
}

function clearLocalVisits() {
  const snapshot = readLocalAnalytics();
  snapshot.visits = { total: 0, dates: {} };
  writeLocalAnalytics(snapshot);
}

function getLocalVisits() {
  return readLocalAnalytics().visits;
}

function recordLocalEvent(metricKey, amount = 1) {
  if (!metricKey || amount <= 0) return;
  const snapshot = readLocalAnalytics();
  if (!snapshot.events || typeof snapshot.events !== "object") {
    snapshot.events = {};
  }
  snapshot.events[metricKey] = (snapshot.events[metricKey] || 0) + amount;
  writeLocalAnalytics(snapshot);
}

function clearLocalEvents() {
  const snapshot = readLocalAnalytics();
  snapshot.events = {};
  writeLocalAnalytics(snapshot);
}

function getLocalEvents() {
  return readLocalAnalytics().events;
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
    recordLocalVisit(today, 1);
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
    recordLocalEvent(metricKey, 1);
  })();
}

async function syncPendingAnalytics() {
  try {
    await Promise.all([flushPendingVisits(), flushPendingEvents()]);
  } catch (err) {
    console.warn("Unable to complete analytics sync:", err);
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
      try {
        await flushPendingVisits();
      } catch (err) {
        console.warn("Unable to flush pending visits before loading dashboard:", err);
      }
      const total = await countApiGet("visits_total");
      visitCount.textContent = formatNumber(total);
      let usingFallback = false;

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
          const localVisits = getLocalVisits();
          const localEntries = Object.entries(localVisits.dates || {});
          if (localEntries.length > 0) {
            usingFallback = true;
            const fragmentFallback = document.createDocumentFragment();
            localEntries
              .sort((a, b) => (a[0] < b[0] ? 1 : -1))
              .slice(0, 7)
              .forEach(([dateKey, value]) => {
                const row = document.createElement("tr");
                const dateCell = document.createElement("td");
                const valueCell = document.createElement("td");
                const dateObj = new Date(dateKey);
                if (!Number.isNaN(dateObj.getTime())) {
                  dateCell.textContent = dateObj.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                } else {
                  dateCell.textContent = dateKey;
                }
                valueCell.textContent = formatNumber(value);
                row.append(dateCell, valueCell);
                fragmentFallback.appendChild(row);
              });
            visitHistoryRows.innerHTML = "";
            visitHistoryRows.appendChild(fragmentFallback);
            visitHistoryTable.classList.remove("hidden");
            visitHistoryEmpty.classList.add("hidden");
          } else {
            visitHistoryTable.classList.add("hidden");
            visitHistoryEmpty.classList.remove("hidden");
          }
        }
      }
      if (hasPendingVisits()) {
        setDashboardStatus("Some visit data is queued locally and will sync once the connection returns.");
      } else if (total <= 0) {
        const localVisits = getLocalVisits();
        if (localVisits.total > 0) {
          usingFallback = true;
          visitCount.textContent = formatNumber(localVisits.total);
          setDashboardStatus("Showing locally cached visit totals. They will sync automatically once a connection is available.");
        } else {
          setDashboardStatus("");
        }
      } else {
        setDashboardStatus("");
      }
      if (usingFallback && !hasPendingVisits()) {
        setDashboardStatus("Showing locally cached visit totals. They will sync automatically once a connection is available.");
      }
    } catch (err) {
      console.warn("Unable to load visit data, falling back to local snapshot:", err);
      const localVisits = getLocalVisits();
      if (localVisits.total > 0) {
        visitCount.textContent = formatNumber(localVisits.total);
        const fragmentFallback = document.createDocumentFragment();
        Object.entries(localVisits.dates || {})
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .slice(0, 7)
          .forEach(([dateKey, value]) => {
            const row = document.createElement("tr");
            const dateCell = document.createElement("td");
            const valueCell = document.createElement("td");
            const dateObj = new Date(dateKey);
            if (!Number.isNaN(dateObj.getTime())) {
              dateCell.textContent = dateObj.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            } else {
              dateCell.textContent = dateKey;
            }
            valueCell.textContent = formatNumber(value);
            row.append(dateCell, valueCell);
            fragmentFallback.appendChild(row);
          });
        if (fragmentFallback.childNodes.length > 0 && visitHistoryRows && visitHistoryTable && visitHistoryEmpty) {
          visitHistoryRows.innerHTML = "";
          visitHistoryRows.appendChild(fragmentFallback);
          visitHistoryTable.classList.remove("hidden");
          visitHistoryEmpty.classList.add("hidden");
        }
        setDashboardStatus("Showing locally cached visit totals. They will sync automatically once a connection is available.");
      } else {
        setDashboardStatus("Unable to load visit data.", true);
      }
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
      try {
        await flushPendingEvents();
      } catch (err) {
        console.warn("Unable to flush pending events before loading dashboard:", err);
      }
      const entries = await Promise.all(Object.keys(engagementMetricsEls).map(key => {
        return countApiGet(`event_${key}`).catch(() => 0);
      }));

      let usingFallback = false;
      const localEvents = getLocalEvents();

      Object.entries(engagementMetricsEls).forEach(([key, el], index) => {
        if (!el) return;
        const value = entries[index];
        if (value > 0) {
          el.textContent = formatNumber(value);
        } else if (localEvents[key]) {
          usingFallback = true;
          el.textContent = formatNumber(localEvents[key]);
        } else {
          el.textContent = "0";
        }
      });
      if (hasPendingEvents()) {
        setEngagementStatus("Some engagement metrics are queued locally and will sync once the connection returns.");
      } else if (usingFallback) {
        setEngagementStatus("Showing locally cached engagement totals. They will sync automatically once a connection is available.");
      } else {
        setEngagementStatus("");
      }
    } catch (err) {
      console.warn("Unable to load engagement metrics, falling back to local snapshot:", err);
      const localEvents = getLocalEvents();
      let hasLocalData = false;
      Object.entries(engagementMetricsEls).forEach(([key, el]) => {
        if (!el) return;
        const value = Number(localEvents[key]) || 0;
        if (value > 0) {
          hasLocalData = true;
          el.textContent = formatNumber(value);
        } else {
          el.textContent = "0";
        }
      });
      if (hasLocalData) {
        setEngagementStatus("Showing locally cached engagement totals. They will sync automatically once a connection is available.");
      } else {
        setEngagementStatus("Unable to load engagement metrics.", true);
      }
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
        clearLocalVisits();
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
        clearLocalEvents();
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
  wireThemeToggle();
  wireFaq();
});

// -------- Theme toggling (light/dark) --------
/**
 * Apply a theme by setting the data-theme attribute on the root element. The
 * provided theme name should be either "light" or "dark". This function
 * persists the choice in localStorage so that the preference sticks on
 * subsequent visits.
 */
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
  } catch (err) {
    console.warn("Unable to persist theme preference:", err);
  }
}

/**
 * Toggle between light and dark themes. Reads the current theme from
 * localStorage (defaulting to dark) and applies the opposite.
 */
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

/**
 * Wire up the theme toggle button in the header. If a previously stored
 * preference exists it will be applied immediately. Clicking the button
 * toggles between light and dark modes.
 */
function wireThemeToggle() {
  const toggleBtn = document.getElementById("themeToggle");
  // Apply persisted theme on load
  try {
    const saved = localStorage.getItem("spxTheme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  } catch (err) {
    console.warn("Unable to read stored theme preference:", err);
  }
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      toggleTheme();
    });
  }
}

// -------- FAQ accordion --------
/**
 * Enhance the FAQ page with collapsible questions. Each FAQ item contains
 * an <h3> followed by a <p>. The paragraphs are hidden by default via
 * CSS (using the .hidden class). Clicking or pressing Enter/Space on the
 * header toggles the visibility of the associated paragraph.
 */
function wireFaq() {
  const items = document.querySelectorAll(".faq-item");
  if (!items || items.length === 0) return;
  items.forEach(item => {
    const header = item.querySelector("h3");
    const content = item.querySelector("p");
    if (!header || !content) return;
    // Ensure paragraphs start hidden if they don't already have the hidden class
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

window.addEventListener("online", syncPendingAnalytics);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    syncPendingAnalytics();
  }
});
