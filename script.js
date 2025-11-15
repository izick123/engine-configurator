/* ============================
      GLOBAL THEME
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

    // ✅ FIX: pull the upgrade text from the label instead of data-name
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
    recordBuilderInteract();
  });

  document.querySelectorAll(".upgrade").forEach((up) =>
    up.addEventListener("change", () => {
      updateBuild();
      recordBuilderInteract();
    })
  );

  updateBuild();
}

/* ============================
      CHECKOUT / WAIVER
=============================== */

function initCheckout() {
  const btn = document.getElementById("checkoutBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const email = prompt(
      "Sorry — SPX Engineering is not accepting orders yet.\n\nEnter your email to get updates:"
    );

    if (email && email.includes("@")) {
      window.location.href = `mailto:spxengineering123@gmail.com?subject=Order%20Interest&body=Please%20notify%20me%20of%20updates.%0D%0AEmail:%20${encodeURIComponent(
        email
      )}`;
    }
  });
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
      window.location.href = `mailto:spxengineering123@gmail.com?subject=F1%20Kart%20Interest&body=Email:%20${encodeURIComponent(
        email
      )}`;
    }
  });
}

/* ============================
      SITE VISITS + METRICS
=============================== */

function incrementSiteVisits() {
  let visits = +localStorage.getItem("spx_visits") || 0;
  visits++;
  localStorage.setItem("spx_visits", visits);
}

function getMetrics() {
  return {
    visits: +localStorage.getItem("spx_visits") || 0,
    buttonClicks: +localStorage.getItem("spx_clicks") || 0,
    builderInteractions: +localStorage.getItem("spx_builder") || 0,
  };
}

function recordClick() {
  let clicks = +localStorage.getItem("spx_clicks") || 0;
  localStorage.setItem("spx_clicks", clicks + 1);
}

function recordBuilderInteract() {
  let val = +localStorage.getItem("spx_builder") || 0;
  localStorage.setItem("spx_builder", val + 1);
}

/* ============================
      ADMIN PAGE
=============================== */

function initAdmin() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = document.getElementById("adminUser").value;
    const pass = document.getElementById("adminPass").value;

    if (user === "admin" && pass === "revlimit") {
      document.getElementById("adminDashboard").classList.remove("hidden");
      form.classList.add("hidden");
      initAdminButtons();
    } else {
      document.getElementById("adminStatus").textContent =
        "Invalid credentials.";
    }
  });
}

function initAdminButtons() {
  const visitsBtn = document.getElementById("toggleVisitPanel");
  const metricsBtn = document.getElementById("toggleEngagementPanel");
  const notesBtn = document.getElementById("toggleNotesPanel");

  const visitPanel = document.getElementById("visitPanel");
  const engagementPanel = document.getElementById("engagementPanel");
  const notesPanel = document.getElementById("notesPanel");

  if (visitsBtn && visitPanel) {
    visitsBtn.addEventListener("click", () => {
      visitPanel.classList.toggle("hidden");
      const m = getMetrics();
      const p = visitPanel.querySelector("p");
      if (p) p.textContent = `Total site visits: ${m.visits}`;
    });
  }

  if (metricsBtn && engagementPanel) {
    metricsBtn.addEventListener("click", () => {
      engagementPanel.classList.toggle("hidden");
      const m = getMetrics();
      const p = engagementPanel.querySelector("p");
      if (p) {
        p.innerHTML = `Button Clicks: ${m.buttonClicks}<br>Builder Actions: ${m.builderInteractions}`;
      }
    });
  }

  if (notesBtn && notesPanel) {
    notesBtn.addEventListener("click", () => {
      notesPanel.classList.toggle("hidden");
    });
  }
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

  incrementSiteVisits();

  document.body.addEventListener("click", recordClick);
});
