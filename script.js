/* ============================
      THEME
=============================== */

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("spxTheme", theme);
}

function initTheme() {
  const saved = localStorage.getItem("spxTheme") || "dark";
  setTheme(saved);

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const newTheme =
        localStorage.getItem("spxTheme") === "dark" ? "light" : "dark";
      setTheme(newTheme);
    });
  }
}

/* ============================
      METRICS HELPERS
=============================== */

function incMetric(key) {
  const fullKey = "spx_" + key;
  let val = +localStorage.getItem(fullKey) || 0;
  localStorage.setItem(fullKey, val + 1);
}

function getMetrics() {
  return {
    visits: +localStorage.getItem("spx_visits") || 0,
    clicks: +localStorage.getItem("spx_clicks") || 0,
    builder: +localStorage.getItem("spx_builder") || 0,
    checkout: +localStorage.getItem("spx_checkout") || 0,
    orders: +localStorage.getItem("spx_orders") || 0,
    waivers: +localStorage.getItem("spx_waivers") || 0
  };
}

/* ============================
      BUILDER PAGE
=============================== */

function updateBuild() {
  const base = document.getElementById("engineBase");
  if (!base) return;

  let totalPrice = +base.selectedOptions[0].dataset.price || 0;
  let totalHp = +base.selectedOptions[0].dataset.hp || 0;

  document.querySelectorAll(".upgrade").forEach((up) => {
    if (up.checked) {
      totalPrice += +up.dataset.price || 0;
      totalHp += +up.dataset.hp || 0;
    }
  });

  const priceEl = document.getElementById("totalPrice");
  const hpEl = document.getElementById("totalHp");
  if (priceEl) priceEl.textContent = totalPrice;
  if (hpEl) hpEl.textContent = totalHp;

  const progress = document.getElementById("hpProgress");
  if (progress) {
    const maxHp = 30; // adjust if you want a different scale
    progress.style.width = Math.min((totalHp / maxHp) * 100, 100) + "%";
  }

  updateSummaryList();
}

function updateSummaryList() {
  const list = document.getElementById("summaryList");
  if (!list) return;

  list.innerHTML = "";
  const selectedUpgrades = [];

  document.querySelectorAll(".upgrade").forEach((up) => {
    if (!up.checked) return;

    // Use the label text so we don't depend on data-name
    const label = up.closest("label");
    let text = "";

    if (label) {
      text = label.textContent.trim();
    } else if (up.value) {
      text = up.value;
    } else {
      text = "Upgrade";
    }

    if (text) selectedUpgrades.push(text);
  });

  if (selectedUpgrades.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No upgrades selected.";
    list.appendChild(li);
    return;
  }

  selectedUpgrades.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    list.appendChild(li);
  });
}

function initBuilder() {
  const base = document.getElementById("engineBase");
  if (!base) return;

  base.addEventListener("change", () => {
    updateBuild();
    incMetric("builder");
  });

  document.querySelectorAll(".upgrade").forEach((up) =>
    up.addEventListener("change", () => {
      updateBuild();
      incMetric("builder");
    })
  );

  updateBuild();
}

/* ============================
      CHECKOUT + WAIVER MODAL
=============================== */

function initCheckout() {
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (!checkoutBtn) return;

  const modal = document.getElementById("waiverModal");
  const closeBtn = document.getElementById("closeModal");
  const agreeBox = document.getElementById("agreeBox");
  const placeOrderBtn = document.getElementById("placeOrder");
  const downloadBtn = document.getElementById("downloadWaiver");

  // Open modal on checkout
  checkoutBtn.addEventListener("click", () => {
    incMetric("checkout");

    if (!modal) {
      // Fallback if modal not present
      simpleOrderPrompt();
      return;
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (agreeBox) agreeBox.checked = false;
    if (placeOrderBtn) placeOrderBtn.disabled = true;
  });

  // Close modal
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    });
  }

  // Enable place order when checked
  if (agreeBox && placeOrderBtn) {
    agreeBox.addEventListener("change", (e) => {
      placeOrderBtn.disabled = !e.target.checked;
    });
  }

  // Place order (really just join email list)
  if (placeOrderBtn && modal) {
    placeOrderBtn.addEventListener("click", () => {
      incMetric("orders");
      simpleOrderPrompt();
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    });
  }

  // Waiver download
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      incMetric("waivers");
      const waiverText =
        "SPX Engineering — Racing Waiver\n\n" +
        "By operating any SPX engine you agree that racing is inherently risky.\n" +
        "SPX is not liable for damage, injury, or loss of any kind.";

      const blob = new Blob([waiverText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SPX_Racing_Waiver.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

function simpleOrderPrompt() {
  const email = prompt(
    "Sorry — SPX Engineering is not accepting orders yet.\n\n" +
      "Enter your email to get updates and dyno results:"
  );

  if (email && email.includes("@")) {
    window.location.href =
      "mailto:spxengineering123@gmail.com" +
      "?subject=" +
      encodeURIComponent("SPX Engine Order Interest") +
      "&body=" +
      encodeURIComponent(
        "Please notify me of SPX updates.\n\nEmail: " + email.trim()
      );
  }
}

/* ============================
      F1 PAGE
=============================== */

function initF1() {
  const btn = document.getElementById("inquireBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const email = prompt("Enter your email for updates on the SPX F1 Kart:");

    if (email && email.includes("@")) {
      window.location.href =
        "mailto:spxengineering123@gmail.com" +
        "?subject=" +
        encodeURIComponent("F1 Series Kart Interest") +
        "&body=" +
        encodeURIComponent("Email: " + email.trim());
    }
  });
}

/* ============================
      ADMIN PAGE
=============================== */

function initAdmin() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = document.getElementById("adminUser").value.trim();
    const pass = document.getElementById("adminPass").value;

    if (user === "admin" && pass === "revlimit") {
      const dash = document.getElementById("adminDashboard");
      document.getElementById("adminStatus").textContent = "";
      dash.classList.remove("hidden");
      form.classList.add("hidden");
      initAdminButtons();
    } else {
      document.getElementById("adminStatus").textContent =
        "Invalid credentials.";
    }
  });
}

function initAdminButtons() {
  const visitBtn = document.getElementById("toggleVisitPanel");
  const metricBtn = document.getElementById("toggleEngagementPanel");
  const notesBtn = document.getElementById("toggleNotesPanel");

  const visitPanel = document.getElementById("visitPanel");
  const engagementPanel = document.getElementById("engagementPanel");
  const notesPanel = document.getElementById("notesPanel");

  if (visitBtn && visitPanel) {
    visitPanel.classList.add("hidden");
    visitBtn.addEventListener("click", () => {
      visitPanel.classList.toggle("hidden");
      updateVisitPanel();
    });
  }

  if (metricBtn && engagementPanel) {
    engagementPanel.classList.add("hidden");
    metricBtn.addEventListener("click", () => {
      engagementPanel.classList.toggle("hidden");
      updateEngagementPanel();
    });
  }

  if (notesBtn && notesPanel) {
    notesPanel.classList.add("hidden");
    notesBtn.addEventListener("click", () => {
      notesPanel.classList.toggle("hidden");
    });
  }
}

function updateVisitPanel() {
  const m = getMetrics();
  const span = document.getElementById("visitCountValue");
  if (span) span.textContent = m.visits;
}

function updateEngagementPanel() {
  const m = getMetrics();

  const checkoutEl = document.getElementById("metricCheckoutClicks");
  const ordersEl = document.getElementById("metricOrderAttempts");
  const waiversEl = document.getElementById("metricWaiverDownloads");
  const clicksEl = document.getElementById("metricTotalClicks");
  const builderEl = document.getElementById("metricBuilderActions");

  if (checkoutEl) checkoutEl.textContent = m.checkout;
  if (ordersEl) ordersEl.textContent = m.orders;
  if (waiversEl) waiversEl.textContent = m.waivers;
  if (clicksEl) clicksEl.textContent = m.clicks;
  if (builderEl) builderEl.textContent = m.builder;
}

/* ============================
      GLOBAL INIT
=============================== */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initBuilder();
  initCheckout();
  initF1();
  initAdmin();

  // site visit
  incMetric("visits");

  // global click tracking
  document.body.addEventListener("click", () => incMetric("clicks"));
});
