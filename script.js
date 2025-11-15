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
            const newTheme = localStorage.getItem("spxTheme") === "dark" ? "light" : "dark";
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

    let totalPrice = +base.selectedOptions[0].dataset.price;
    let totalHp = +base.selectedOptions[0].dataset.hp;

    document.querySelectorAll(".upgrade").forEach(up => {
        if (up.checked) {
            totalPrice += +up.dataset.price;
            totalHp += +up.dataset.hp;
        }
    });

    document.getElementById("totalPrice").textContent = totalPrice;
    document.getElementById("totalHp").textContent = totalHp;

    const progress = document.getElementById("hpProgress");
    if (progress) {
        const maxHp = 30; 
        progress.style.width = Math.min((totalHp / maxHp) * 100, 100) + "%";
    }

    updateSummaryList();
}

function updateSummaryList() {
    const list = document.getElementById("summaryList");
    if (!list) return;

    list.innerHTML = "";
    const selectedUpgrades = [];

    document.querySelectorAll(".upgrade").forEach(up => {
        if (up.checked) {
            selectedUpgrades.push(up.dataset.name);
        }
    });

    if (selectedUpgrades.length === 0) {
        list.innerHTML = "<li>No upgrades selected.</li>";
    } else {
        selectedUpgrades.forEach(name => {
            const li = document.createElement("li");
            li.textContent = name;
            list.appendChild(li);
        });
    }
}

function initBuilder() {
    const base = document.getElementById("engineBase");
    if (!base) return;

    base.addEventListener("change", updateBuild);
    document.querySelectorAll(".upgrade").forEach(up =>
        up.addEventListener("change", updateBuild)
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
            window.location.href =
                `mailto:spxengineering123@gmail.com?subject=Order Interest&body=Please notify me of updates.%0D%0AEmail: ${email}`;
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
            window.location.href =
                `mailto:spxengineering123@gmail.com?subject=F1 Kart Interest&body=Email: ${email}`;
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
        builderInteractions: +localStorage.getItem("spx_builder") || 0
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

    form.addEventListener("submit", e => {
        e.preventDefault();
        const user = document.getElementById("adminUser").value;
        const pass = document.getElementById("adminPass").value;

        if (user === "admin" && pass === "revlimit") {
            document.getElementById("adminDashboard").classList.remove("hidden");
            form.classList.add("hidden");
            initAdminButtons();
        } else {
            document.getElementById("adminStatus").textContent = "Invalid credentials.";
        }
    });
}

function initAdminButtons() {
    /* Show Visits */
    document.getElementById("toggleVisitPanel").addEventListener("click", () => {
        const panel = document.getElementById("visitPanel");
        panel.classList.toggle("hidden");
        panel.querySelector("p").textContent =
            `Total site visits: ${getMetrics().visits}`;
    });

    /* Show Metrics */
    document.getElementById("toggleEngagementPanel").addEventListener("click", () => {
        const panel = document.getElementById("engagementPanel");
        panel.classList.toggle("hidden");

        const m = getMetrics();
        panel.querySelector("p").innerHTML =
            `Button Clicks: ${m.buttonClicks}<br>Builder Actions: ${m.builderInteractions}`;
    });

    /* Notes Panel */
    document.getElementById("toggleNotesPanel").addEventListener("click", () => {
        document.getElementById("notesPanel").classList.toggle("hidden");
    });
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

    /* attach global click counter */
    document.body.addEventListener("click", recordClick);

    /* builder interactions */
    document.querySelectorAll(".upgrade").forEach(up =>
        up.addEventListener("change", recordBuilderInteract)
    );
});
