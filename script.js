/* === Config === */
const ADMIN_USER = "admin";
const ADMIN_PASS = "revlimit";

/* === Theme toggling === */
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  localStorage.setItem("spxTheme", theme);
}
function toggleTheme() {
  const theme = localStorage.getItem("spxTheme") === "light" ? "dark" : "light";
  setTheme(theme);
}
function initTheme() {
  const saved = localStorage.getItem("spxTheme") || "dark";
  setTheme(saved);
  document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
}

/* === Builder === */
function computeMaxHp() {
  const baseSelect = document.getElementById("engineBase");
  if (!baseSelect) return 0;
  let maxHp = 0;
  baseSelect.querySelectorAll("option").forEach(opt => {
    maxHp = Math.max(maxHp, +opt.dataset.hp || 0);
  });
  const radioGroupMax = {};
  document.querySelectorAll(".upgrade").forEach(up => {
    if (up.type === "radio") {
      radioGroupMax[up.name] = Math.max(radioGroupMax[up.name] || 0, +up.dataset.hp || 0);
    }
  });
  Object.values(radioGroupMax).forEach(hp => (maxHp += hp));
  document.querySelectorAll(".upgrade[type=checkbox]").forEach(up => {
    maxHp += +up.dataset.hp || 0;
  });
  return maxHp;
}

function updateBuild() {
  const base = document.getElementById("engineBase");
  let price = +base.selectedOptions[0].dataset.price || 0;
  let hp = +base.selectedOptions[0].dataset.hp || 0;
  document.querySelectorAll(".upgrade").forEach(up => {
    if (up.checked) {
      price += +up.dataset.price || 0;
      hp += +up.dataset.hp || 0;
    }
  });
  document.getElementById("totalPrice").textContent = price;
  document.getElementById("totalHp").textContent = hp;
  const progress = document.getElementById("hpProgress");
  if (progress && window.MAX_HP) {
    progress.style.width = Math.min(hp / window.MAX_HP * 100, 100) + "%";
  }
  // summary list
  const list = document.getElementById("summaryList");
  list.innerHTML = "";
  const selected = [];
  document.querySelectorAll(".upgrade").forEach(up => {
    if (up.checked) {
      const name = up.parentElement.textContent.trim();
      if (+up.dataset.price || +up.dataset.hp) selected.push(name);
    }
  });
  if (selected.length) {
    selected.forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "No upgrades selected.";
    list.appendChild(li);
  }
}

function initBuilder() {
  const base = document.getElementById("engineBase");
  if (!base) return;
  window.MAX_HP = computeMaxHp();
  base.addEventListener("change", updateBuild);
  document.querySelectorAll(".upgrade").forEach(el => el.addEventListener("change", updateBuild));
  updateBuild();
}

/* === Waiver / Checkout === */
function initWaiver() {
  const modal = document.getElementById("waiverModal");
  if (!modal) return;
  document.getElementById("checkoutBtn").addEventListener("click", () => {
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("agreeBox").checked = false;
    document.getElementById("placeOrder").disabled = true;
  });
  document.getElementById("closeModal").addEventListener("click", () => modal.setAttribute("aria-hidden", "true"));
  document.getElementById("agreeBox").addEventListener("change", e => {
    document.getElementById("placeOrder").disabled = !e.target.checked;
  });
  document.getElementById("placeOrder").addEventListener("click", () => {
    const email = prompt("Sorry, we are not taking orders currently.\nEnter your email to join our updates:");
    if (email && email.includes("@")) {
      const subject = encodeURIComponent("SPX order interest");
      const body = encodeURIComponent(`Please add me to updates.\nEmail: ${email}`);
      window.location.href = `mailto:spxengineering123@gmail.com?subject=${subject}&body=${body}`;
    }
    modal.setAttribute("aria-hidden", "true");
  });
  document.getElementById("downloadWaiver").addEventListener("click", () => {
    const waiver = "SPX Engineering Waiver...";
    const blob = new Blob([waiver], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "waiver.txt";
    a.click();
    URL.revokeObjectURL(url);
  });
}

/* === F1 Inquiry button === */
function initF1() {
  const btn = document.getElementById("inquireBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      const email = prompt("Enter your email to join SPX F1 updates:");
      if (email && email.includes("@")) {
        const subject = encodeURIComponent("F1 Series Kart interest");
        const body = encodeURIComponent(`Please add me to the F1 mailing list.\nEmail: ${email}`);
        window.location.href = `mailto:spxengineering123@gmail.com?subject=${subject}&body=${body}`;
      }
    });
  }
}

/* === Admin === */
function loadNotes() {
  const notes = JSON.parse(localStorage.getItem("spxNotes") || "[]");
  const list = document.getElementById("notesList");
  list.innerHTML = "";
  if (!notes.length) {
    const li = document.createElement("li");
    li.textContent = "No notes yet.";
    li.className = "small muted";
    list.appendChild(li);
    return;
  }
  notes.forEach(note => {
    const li = document.createElement("li");
    li.className = "note-item";
    if (note.image) {
      const img = document.createElement("img");
      img.src = note.image;
      li.appendChild(img);
    }
    if (note.text) {
      const p = document.createElement("p");
      p.textContent = note.text;
      li.appendChild(p);
    }
    list.appendChild(li);
  });
}

function saveNote() {
  const fileInput = document.getElementById("noteImage");
  const text = document.getElementById("noteText").value.trim();
  if (!text && (!fileInput || !fileInput.files.length)) {
    alert("Please enter text or choose an image.");
    return;
  }
  const handleSave = imgData => {
    const notes = JSON.parse(localStorage.getItem("spxNotes") || "[]");
    notes.push({ text, image: imgData });
    localStorage.setItem("spxNotes", JSON.stringify(notes));
    document.getElementById("noteText").value = "";
    if (fileInput) fileInput.value = "";
    loadNotes();
  };
  if (fileInput && fileInput.files.length) {
    const reader = new FileReader();
    reader.onload = () => handleSave(reader.result);
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    handleSave(null);
  }
}

function initAdmin() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const user = document.getElementById("adminUser").value.trim();
    const pass = document.getElementById("adminPass").value;
    const status = document.getElementById("adminStatus");
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      status.textContent = "";
      document.getElementById("adminDashboard").classList.remove("hidden");
      form.classList.add("hidden");
      // notes panel
      document.getElementById("saveNote").addEventListener("click", saveNote);
      loadNotes();
      // toggle panels
      const panels = {
        visitPanel: document.getElementById("visitPanel"),
        engagementPanel: document.getElementById("engagementPanel"),
        notesPanel: document.getElementById("notesPanel")
      };
      Object.keys(panels).forEach(panelID => {
        const btnID = "toggle" + panelID.charAt(0).toUpperCase() + panelID.slice(1);
        const btn = document.getElementById(btnID);
        const panel = panels[panelID];
        if (btn && panel) {
          btn.addEventListener("click", () => {
            const isVisible = !panel.classList.contains("hidden");
            Object.values(panels).forEach(p => p.classList.add("hidden"));
            if (!isVisible) {
              panel.classList.remove("hidden");
              if (panelID === "notesPanel") loadNotes();
            }
          });
        }
      });
    } else {
      status.textContent = "Invalid credentials.";
    }
  });
}

/* === Initialization === */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initBuilder();
  initWaiver();
  initF1();
  initAdmin();
  wireFaq();  // your existing FAQ toggle logic
});
