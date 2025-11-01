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
    modal.setAttribute("aria-hidden", "false");
    agreeBox.checked = false;
    placeOrder.disabled = true;
  });
  closeModal.addEventListener("click", () => modal.setAttribute("aria-hidden", "true"));
  agreeBox.addEventListener("change", () => placeOrder.disabled = !agreeBox.checked);

  placeOrder.addEventListener("click", () => {
    const total = document.getElementById("totalPrice").textContent;
    const hp = document.getElementById("totalHp").textContent;
    alert(`Order placed!\nTotal: $${total}\nEstimated HP: ${hp}\n(Implement payment/email later.)`);
    modal.setAttribute("aria-hidden", "true");
  });

  downloadBtn.addEventListener("click", () => {
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
const ADMIN_USER = "admin";
const ADMIN_PASS = "revlimit";

function shouldTrackVisit() {
  const body = document.body;
  if (!body) return false;
  return body.dataset.trackVisit !== "false";
}

function getVisitCount() {
  const stored = localStorage.getItem(VISIT_STORAGE_KEY);
  const parsed = stored ? parseInt(stored, 10) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function recordVisit() {
  if (!shouldTrackVisit()) return;
  const count = getVisitCount();
  localStorage.setItem(VISIT_STORAGE_KEY, String(count + 1));
}

function wireAdmin() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return; // not on admin page

  const userField = document.getElementById("adminUser");
  const passField = document.getElementById("adminPass");
  const status = document.getElementById("adminStatus");
  const dashboard = document.getElementById("adminDashboard");
  const visitCount = document.getElementById("visitCount");
  const resetBtn = document.getElementById("resetVisits");
  const dashboardStatus = document.getElementById("adminDashboardStatus");
  const visitPanel = document.getElementById("visitPanel");
  const toggleVisitPanel = document.getElementById("toggleVisitPanel");

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
      visitCount.textContent = String(getVisitCount());
      setDashboardStatus("");
    } catch (err) {
      setDashboardStatus("Unable to load visit data.", true);
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
      if (toggleVisitPanel) {
        toggleVisitPanel.setAttribute("aria-expanded", "false");
        toggleVisitPanel.focus();
      }
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

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      try {
        localStorage.setItem(VISIT_STORAGE_KEY, "0");
        showVisits();
        setDashboardStatus("Visit counter reset.");
      } catch (err) {
        setDashboardStatus("Unable to reset visit data.", true);
      }
    });
  }

  if (toggleVisitPanel && visitPanel) {
    toggleVisitPanel.addEventListener("click", () => {
      const panelHidden = visitPanel.classList.contains("hidden");
      if (panelHidden) {
        visitPanel.classList.remove("hidden");
        toggleVisitPanel.setAttribute("aria-expanded", "true");
        showVisits();
      } else {
        visitPanel.classList.add("hidden");
        toggleVisitPanel.setAttribute("aria-expanded", "false");
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try { recordVisit(); } catch (err) {
    console.warn("Unable to record visit count:", err);
  }
  wireBuilder();
  wireWaiver();
  wireAdmin();
});
