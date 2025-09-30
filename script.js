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
document.addEventListener("DOMContentLoaded", () => {
  wireBuilder();
  wireWaiver();
});
