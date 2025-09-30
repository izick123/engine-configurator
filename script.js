function updateBuild() {
  const engineBase = document.getElementById("engineBase");
  let basePrice = parseInt(engineBase.selectedOptions[0].dataset.price);
  let baseHp = parseInt(engineBase.selectedOptions[0].dataset.hp);

  let totalPrice = basePrice;
  let totalHp = baseHp;

  document.querySelectorAll(".upgrade").forEach(upgrade => {
    if (upgrade.checked) {
      totalPrice += parseInt(upgrade.dataset.price);
      totalHp += parseInt(upgrade.dataset.hp);
    }
  });

  document.getElementById("totalPrice").textContent = totalPrice;
  document.getElementById("totalHp").textContent = totalHp;
}

document.getElementById("engineBase").addEventListener("change", updateBuild);
document.querySelectorAll(".upgrade").forEach(upgrade => {
  upgrade.addEventListener("change", updateBuild);
});

// Initialize on load
updateBuild();
