// EZ FUEL - savings calculator
// Math: monthlySavings = gallons * discountCents / 100
// Tiers are now determined by fleet size (number of trucks), not volume.

(function () {
  // Discount tiers by number of active trucks (cents per gallon)
  // Easy to customize - edit these values to change public savings figures.
  const TIERS = [
    { min: 1,   max: 5,        cpg: 12, label: "Starter" },
    { min: 6,   max: 20,       cpg: 25, label: "Growth" },
    { min: 21,  max: 50,       cpg: 40, label: "Pro" },
    { min: 51,  max: Infinity, cpg: 60, label: "Enterprise" },
  ];

  function tierFor(trucks) {
    const t = Math.max(1, Math.floor(trucks || 1));
    return TIERS.find(x => t >= x.min && t <= x.max) || TIERS[0];
  }

  function fmtUSD(n) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(Math.round(n));
  }

  function bind(root) {
    const input = root.querySelector('[data-calc-input]');           // monthly gallons
    const slider = root.querySelector('[data-calc-slider]');         // monthly gallons slider
    const trucksInput = root.querySelector('[data-calc-trucks]');    // number of trucks (optional)
    const trucksSlider = root.querySelector('[data-calc-trucks-slider]');
    const outMonthly = root.querySelector('[data-calc-monthly]');
    const outAnnual = root.querySelector('[data-calc-annual]');
    const outTier = root.querySelector('[data-calc-tier]');
    const outCpg = root.querySelector('[data-calc-cpg]');

    function getTrucks() {
      if (!trucksInput) return 1;
      return Math.max(1, parseInt(trucksInput.value, 10) || 1);
    }

    function update() {
      const gallons = Math.max(0, parseFloat(input.value) || 0);
      const trucks = getTrucks();
      const t = tierFor(trucks);
      const monthly = gallons * t.cpg / 100;
      const annual = monthly * 12;
      if (outMonthly) outMonthly.textContent = fmtUSD(monthly);
      if (outAnnual)  outAnnual.textContent  = fmtUSD(annual);
      if (outTier)    outTier.textContent    = t.label;
      if (outCpg)     outCpg.textContent     = `${t.cpg}¢/gal`;
    }

    input.addEventListener('input', () => {
      if (slider) slider.value = Math.min(Math.max(parseFloat(input.value) || 0, 0), slider.max);
      update();
    });
    if (slider) {
      slider.addEventListener('input', () => {
        input.value = slider.value;
        update();
      });
    }
    if (trucksInput) {
      trucksInput.addEventListener('input', () => {
        if (trucksSlider) trucksSlider.value = Math.min(Math.max(parseInt(trucksInput.value, 10) || 1, 1), trucksSlider.max);
        update();
      });
    }
    if (trucksSlider) {
      trucksSlider.addEventListener('input', () => {
        if (trucksInput) trucksInput.value = trucksSlider.value;
        update();
      });
    }
    update();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-savings-calculator]').forEach(bind);
  });
})();
