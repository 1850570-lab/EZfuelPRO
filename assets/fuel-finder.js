// EZ FUEL - Fuel Finder Map (Leaflet + OSM + Nominatim geocoding) - redesigned
(function () {
  let map, allStops = [], stopMarkers = [], routeLine = null, fromMarker = null, toMarker = null;
  let activeBrand = 'all';
  let lastResults = [];

  const BRAND_COLORS = {
    "Pilot": "#FFB300",
    "Flying J": "#E63946",
    "TA": "#1976D2",
    "Petro": "#6A1B9A",
    "Love's": "#D32F2F",
    "Husky": "#2E7D32",
    "Petro-Canada": "#00838F"
  };
  const FALLBACK_COLOR = "#22D3EE";

  const AMENITY_ICONS = {
    "Showers": "shower-head",
    "Parking": "parking-square",
    "DEF": "droplets",
    "Restaurant": "utensils",
    "Scales": "scale",
    "Service Bay": "wrench",
    "Laundry": "washing-machine",
    "Subway": "sandwich",
    "Iron Skillet": "utensils-crossed"
  };

  function brandColor(brand) {
    return BRAND_COLORS[brand] || FALLBACK_COLOR;
  }

  // Haversine distance in miles
  function haversineMiles(a, b) {
    const R = 3958.8;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const sin1 = Math.sin(dLat / 2), sin2 = Math.sin(dLng / 2);
    const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function pointToSegmentMiles(p, a, b) {
    const k = Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
    const ax = a.lng * k, ay = a.lat;
    const bx = b.lng * k, by = b.lat;
    const px = p.lng * k, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return haversineMiles(p, { lat: cy, lng: cx / k });
  }

  function makeMarker(stop, dim) {
    const color = brandColor(stop.brand);
    const html = `<div class="ts-pin" style="--c:${color}">
      <span>$${(3.50 - stop.discount).toFixed(2)}</span>
    </div>`;
    return L.marker([stop.lat, stop.lng], {
      icon: L.divIcon({
        className: 'ts-pin-wrap' + (dim ? ' ts-pin-dim' : ''),
        html: html,
        iconSize: [56, 28],
        iconAnchor: [28, 28]
      })
    });
  }

  function popupHtml(stop) {
    const amenityIcons = stop.amenities.map(a => `<span class="ts-amen">${a}</span>`).join('');
    return `
      <div class="ts-popup">
        <div class="ts-pop-head" style="border-color:${brandColor(stop.brand)}">
          <strong>${stop.brand}</strong>
          <span class="ts-pop-price">$${(3.50 - stop.discount).toFixed(2)}/gal</span>
        </div>
        <p class="ts-pop-loc">${stop.name}<br>${stop.city}, ${stop.state}</p>
        <p class="ts-pop-disc">Save ${(stop.discount * 100).toFixed(0)}¢/gallon</p>
        <div class="ts-pop-amens">${amenityIcons}</div>
      </div>`;
  }

  function amenityIconHtml(amenity) {
    const iconName = AMENITY_ICONS[amenity];
    if (!iconName) return '';
    return `<span class="ts-li-amen-icon" title="${amenity}"><i data-lucide="${iconName}"></i></span>`;
  }

  function listItemHtml(stop, idx) {
    const color = brandColor(stop.brand);
    const isBest = idx === 0;
    const amenities = (stop.amenities || []).slice(0, 5).map(amenityIconHtml).join('');
    const distChip = stop.distMiles != null
      ? `<span class="ts-li-dist"><i data-lucide="route" style="width:11px;height:11px"></i>${stop.distMiles.toFixed(0)} mi off route</span>`
      : '';
    return `
      <button class="ts-list-item${isBest ? ' is-best' : ''}" data-stop-id="${stop.id}" style="--brand:${color}">
        <div class="ts-li-rank">${idx + 1}</div>
        <div class="ts-li-body">
          <div class="ts-li-head">
            <strong><span class="ts-li-brand-dot" style="--brand:${color}"></span>${stop.brand}</strong>
            <span class="ts-li-price">$${(3.50 - stop.discount).toFixed(2)}<span>/gal</span></span>
          </div>
          <p class="ts-li-loc"><i data-lucide="map-pin" style="width:11px;height:11px"></i>${stop.city}, ${stop.state}${stop.country === 'CA' ? ' · CA' : ''}</p>
          <div class="ts-li-meta">
            <span class="ts-li-disc"><i data-lucide="trending-down" style="width:11px;height:11px"></i>Save ${(stop.discount * 100).toFixed(0)}¢/gal</span>
            ${distChip}
          </div>
          ${amenities ? `<div class="ts-li-amen">${amenities}</div>` : ''}
        </div>
      </button>
    `;
  }

  function renderStopList(stops, panelEl) {
    if (!stops.length) {
      panelEl.innerHTML = `
        <div class="ff-empty-state">
          <div class="ff-empty-icon"><i data-lucide="search-x" class="w-8 h-8"></i></div>
          <p class="ff-empty-title">No stops found</p>
          <p class="ff-empty-text">No in-network stops within 50 miles of this route. Try widening the search or different cities.</p>
        </div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    panelEl.innerHTML = stops.map((s, idx) => listItemHtml(s, idx)).join('');

    if (window.lucide) window.lucide.createIcons();

    panelEl.querySelectorAll('[data-stop-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = +btn.getAttribute('data-stop-id');
        const stop = stops.find(s => s.id === id);
        if (stop) {
          map.flyTo([stop.lat, stop.lng], 9, { duration: 0.8 });
          const marker = stopMarkers.find(m => m.__stopId === id);
          if (marker) marker.openPopup();
        }
      });
    });
  }

  async function geocode(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('Geocoding failed');
    const data = await resp.json();
    if (!data.length) throw new Error(`Couldn't find "${query}"`);
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
  }

  function clearRouteVisuals() {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (fromMarker) { map.removeLayer(fromMarker); fromMarker = null; }
    if (toMarker) { map.removeLayer(toMarker); toMarker = null; }
  }

  function applyBrandFilter() {
    stopMarkers.forEach(m => map.removeLayer(m));
    stopMarkers = [];
    const filtered = activeBrand === 'all' ? allStops : allStops.filter(s => s.brand === activeBrand);
    filtered.forEach(stop => {
      const m = makeMarker(stop);
      m.__stopId = stop.id;
      m.bindPopup(popupHtml(stop), { maxWidth: 240 });
      m.addTo(map);
      stopMarkers.push(m);
    });
    // Re-apply current results filter if any
    if (lastResults.length) {
      const filteredResults = activeBrand === 'all'
        ? lastResults
        : lastResults.filter(s => s.brand === activeBrand);
      const panelEl = document.getElementById('fuel-finder-results');
      renderStopList(filteredResults, panelEl);
    }
  }

  function showAllStops() {
    applyBrandFilter();
  }

  async function findStopsAlongRoute(fromQuery, toQuery, panelEl, statusEl, btnEl) {
    btnEl.disabled = true;
    btnEl.dataset.original = btnEl.dataset.original || btnEl.innerHTML;
    btnEl.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4"></i><span>Finding…</span>';
    if (window.lucide) window.lucide.createIcons();
    statusEl.textContent = 'Looking up cities…';
    statusEl.style.color = '';

    try {
      const [fromGeo, toGeo] = await Promise.all([geocode(fromQuery), geocode(toQuery)]);

      clearRouteVisuals();

      routeLine = L.polyline([
        [fromGeo.lat, fromGeo.lng],
        [toGeo.lat, toGeo.lng]
      ], { color: '#22D3EE', weight: 4, opacity: 0.7, dashArray: '6,8' }).addTo(map);

      fromMarker = L.marker([fromGeo.lat, fromGeo.lng], {
        icon: L.divIcon({ className: 'ts-endpoint ts-endpoint-from', html: '<span>A</span>', iconSize: [32, 32], iconAnchor: [16, 16] })
      }).bindPopup(`<b>From:</b> ${fromGeo.display}`).addTo(map);

      toMarker = L.marker([toGeo.lat, toGeo.lng], {
        icon: L.divIcon({ className: 'ts-endpoint ts-endpoint-to', html: '<span>B</span>', iconSize: [32, 32], iconAnchor: [16, 16] })
      }).bindPopup(`<b>To:</b> ${toGeo.display}`).addTo(map);

      const MAX_OFF_ROUTE_MI = 50;
      const candidates = allStops.map(stop => ({
        ...stop,
        distMiles: pointToSegmentMiles({ lat: stop.lat, lng: stop.lng }, fromGeo, toGeo)
      })).filter(s => s.distMiles <= MAX_OFF_ROUTE_MI)
        .sort((a, b) => (b.discount - a.discount) || (a.distMiles - b.distMiles))
        .slice(0, 12);

      lastResults = candidates;

      stopMarkers.forEach(m => map.removeLayer(m));
      stopMarkers = [];
      const candidateIds = new Set(candidates.map(c => c.id));
      const visibleStops = activeBrand === 'all' ? allStops : allStops.filter(s => s.brand === activeBrand);
      visibleStops.forEach(stop => {
        const m = makeMarker(stop, !candidateIds.has(stop.id));
        m.__stopId = stop.id;
        m.bindPopup(popupHtml(stop), { maxWidth: 240 });
        m.addTo(map);
        stopMarkers.push(m);
      });

      const filteredResults = activeBrand === 'all' ? candidates : candidates.filter(s => s.brand === activeBrand);
      renderStopList(filteredResults, panelEl);

      const bounds = L.latLngBounds([
        [fromGeo.lat, fromGeo.lng],
        [toGeo.lat, toGeo.lng]
      ]);
      candidates.forEach(c => bounds.extend([c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });

      const totalMi = haversineMiles(fromGeo, toGeo).toFixed(0);
      const avgDiscount = candidates.length
        ? (candidates.reduce((s, c) => s + c.discount, 0) / candidates.length * 100).toFixed(0)
        : '0';
      statusEl.innerHTML = `<strong>${candidates.length}</strong> stops · <strong>${totalMi}-mi</strong> route · avg <strong>${avgDiscount}¢/gal</strong>`;
      statusEl.style.color = '';
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || 'Something went wrong. Try again.';
      statusEl.style.color = '#f87171';
    } finally {
      btnEl.disabled = false;
      btnEl.innerHTML = btnEl.dataset.original;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  async function init() {
    try {
      const resp = await fetch('assets/truck-stops.json');
      allStops = await resp.json();
    } catch (e) {
      console.error('Failed to load truck stops:', e);
      return;
    }

    map = L.map('fuel-finder-map', {
      center: [39.5, -98.0],
      zoom: 4,
      scrollWheelZoom: true,
      worldCopyJump: true,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    showAllStops();

    const form = document.getElementById('fuel-finder-form');
    const fromInput = document.getElementById('ff-from');
    const toInput = document.getElementById('ff-to');
    const panelEl = document.getElementById('fuel-finder-results');
    const statusEl = document.getElementById('fuel-finder-status');
    const btnEl = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const from = fromInput.value.trim();
      const to = toInput.value.trim();
      if (!from || !to) {
        statusEl.textContent = 'Enter both From and To cities.';
        statusEl.style.color = '#f87171';
        return;
      }
      findStopsAlongRoute(from, to, panelEl, statusEl, btnEl);
    });

    // Swap button
    const swapBtn = document.getElementById('ff-swap');
    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        const tmp = fromInput.value;
        fromInput.value = toInput.value;
        toInput.value = tmp;
        if (fromInput.value && toInput.value) {
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    }

    // Quick route chips
    document.querySelectorAll('.ff-route-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        fromInput.value = chip.dataset.from;
        toInput.value = chip.dataset.to;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    });

    // Brand filter chips
    document.querySelectorAll('.ff-brand-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.ff-brand-chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeBrand = chip.dataset.brand;
        applyBrandFilter();
      });
    });

    // Reset button
    const resetBtn = document.getElementById('ff-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        fromInput.value = '';
        toInput.value = '';
        clearRouteVisuals();
        lastResults = [];
        showAllStops();
        panelEl.innerHTML = `
          <div class="ff-empty-state">
            <div class="ff-empty-icon"><i data-lucide="route" class="w-8 h-8"></i></div>
            <p class="ff-empty-title">Plan your trip</p>
            <p class="ff-empty-text">Enter From and To above to surface the cheapest in-network stops along your route.</p>
          </div>`;
        if (window.lucide) window.lucide.createIcons();
        statusEl.innerHTML = `<strong>${allStops.length}</strong> in-network stops · US &amp; Canada`;
        statusEl.style.color = '';
        map.setView([39.5, -98.0], 4);
      });
    }

    statusEl.innerHTML = `<strong>${allStops.length}</strong> in-network stops · US &amp; Canada`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
