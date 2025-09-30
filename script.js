// ----- Builder math -----
function updateBuild() {
  const engineBase = document.getElementById("engineBase");
  let basePrice = parseInt(engineBase.selectedOptions[0].dataset.price, 10);
  let baseHp = parseInt(engineBase.selectedOptions[0].dataset.hp, 10);

  let totalPrice = basePrice;
  let totalHp = baseHp;

  document.querySelectorAll(".upgrade").forEach(up => {
    if (up.checked) {
      totalPrice += parseInt(up.dataset.price, 10);
      totalHp += parseInt(up.dataset.hp, 10);
    }
  });

  document.getElementById("totalPrice").textContent = totalPrice;
  document.getElementById("totalHp").textContent = totalHp;
}

document.getElementById("engineBase").addEventListener("change", updateBuild);
document.querySelectorAll(".upgrade").forEach(up =>
  up.addEventListener("change", updateBuild)
);
updateBuild();

// ----- Waiver modal -----
const modal = document.getElementById("waiverModal");
const checkoutBtn = document.getElementById("checkoutBtn");
const closeModal = document.getElementById("closeModal");
const agreeBox = document.getElementById("agreeBox");
const placeOrderBtn = document.getElementById("placeOrder");
const downloadWaiverBtn = document.getElementById("downloadWaiver");

checkoutBtn.addEventListener("click", () => {
  modal.setAttribute("aria-hidden", "false");
  agreeBox.checked = false;
  placeOrderBtn.disabled = true;
});

closeModal.addEventListener("click", () => {
  modal.setAttribute("aria-hidden", "true");
});

agreeBox.addEventListener("change", () => {
  placeOrderBtn.disabled = !agreeBox.checked;
});

// Fake checkout for now (replace with real flow later)
placeOrderBtn.addEventListener("click", () => {
  const total = document.getElementById("totalPrice").textContent;
  const hp = document.getElementById("totalHp").textContent;
  alert(`Order placed!\nTotal: $${total}\nEstimated HP: ${hp}\n(Implement payment later.)`);
  modal.setAttribute("aria-hidden", "true");
});

// Generate a simple text waiver the user can save
downloadWaiverBtn.addEventListener("click", () => {
  const waiverText = `
[Your Brand] — Racing Use Waiver & Terms

1) Racing/off-road use only.
2) High-performance engines may require expert installation/tuning.
3) No liability for damage, injury, or death from use or misuse.
4) Warranty void once sealed components are opened or unit is operated.
5) Horsepower figures are estimates and may vary.

Customer Name: _________________________
Signature:     _________________________
Date:          _________________________
  `.trim();

  const blob = new Blob([waiverText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "waiver.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
