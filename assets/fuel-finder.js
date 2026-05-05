// EZ FUEL - Fuel Finder Map (Leaflet + OSM + Nominatim geocoding)
(function () {
  let map, allStops = [], stopMarkers = [], routeLine = null, fromMarker = null, toMarker = null;

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

  function brandColor(brand) {
    return BRAND_COLORS[brand] || FALLBACK_COLOR;
  }

  // Haversine distance in miles between two lat/lng points
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

  // Distance in miles from point P to line segment AB (great-circle approximation)
  function pointToSegmentMiles(p, a, b) {
    // Project to a flat plane (good enough for ranges < ~500 miles)
    const k = Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
    const ax = a.lng * k, ay = a.lat;
    const bx = b.lng * k, by = b.lat;
    const px = p.lng * k, py = p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    // Convert back to lat/lng for haversine
    return haversineMiles(p, { lat: cy, lng: cx / k });
  }

  function makeMarker(stop) {
    const color = brandColor(stop.brand);
    const html = `<div class="ts-pin" style="--c:${color}">
      <span>$${(3.50 - stop.discount).toFixed(2)}</span>
    </div>`;
    return L.marker([stop.lat, stop.lng], {
      icon: L.divIcon({
        className: 'ts-pin-wrap',
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

  function renderStopList(stops, panelEl) {
    if (!stops.length) {
      panelEl.innerHTML = '<p class="ts-empty">No stops found near this route. Try widening the search or different cities.</p>';
      return;
    }
    panelEl.innerHTML = stops.map((s, idx) => `
      <button class="ts-list-item" data-stop-id="${s.id}">
        <div class="ts-li-rank">${idx + 1}</div>
        <div class="ts-li-body">
          <div class="ts-li-head">
            <strong>${s.brand}</strong>
            <span class="ts-li-price" style="color:${brandColor(s.brand)}">$${(3.50 - s.discount).toFixed(2)}<span>/gal</span></span>
          </div>
          <p class="ts-li-loc">${s.city}, ${s.state}${s.country === 'CA' ? ' · CA' : ''}</p>
          <div class="ts-li-meta">
            <span class="ts-li-disc">Save ${(s.discount * 100).toFixed(0)}¢/gal</span>
            ${s.distMiles != null ? `<span class="ts-li-dist">${s.distMiles.toFixed(0)} mi off route</span>` : ''}
          </div>
        </div>
      </button>
    `).join('');

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
    // Use OSM Nominatim (free, ~1 req/sec)
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
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

  function showAllStops(filterFn) {
    stopMarkers.forEach(m => map.removeLayer(m));
    stopMarkers = [];
    const stops = filterFn ? allStops.filter(filterFn) : allStops;
    stops.forEach(stop => {
      const m = makeMarker(stop);
      m.__stopId = stop.id;
      m.bindPopup(popupHtml(stop), { maxWidth: 240 });
      m.addTo(map);
      stopMarkers.push(m);
    });
  }

  async function findStopsAlongRoute(fromQuery, toQuery, panelEl, statusEl, btnEl) {
    btnEl.disabled = true;
    btnEl.dataset.original = btnEl.dataset.original || btnEl.innerHTML;
    btnEl.innerHTML = 'Finding stops…';
    statusEl.textContent = 'Looking up cities…';
    statusEl.style.color = '';

    try {
      const [fromGeo, toGeo] = await Promise.all([geocode(fromQuery), geocode(toQuery)]);

      clearRouteVisuals();

      // Draw route as a great-circle line (visual approximation)
      routeLine = L.polyline([
        [fromGeo.lat, fromGeo.lng],
        [toGeo.lat, toGeo.lng]
      ], { color: '#22D3EE', weight: 4, opacity: 0.65, dashArray: '6,8' }).addTo(map);

      fromMarker = L.marker([fromGeo.lat, fromGeo.lng], {
        icon: L.divIcon({ className: 'ts-endpoint ts-endpoint-from', html: '<span>A</span>', iconSize: [32, 32], iconAnchor: [16, 16] })
      }).bindPopup(`<b>From:</b> ${fromGeo.display}`).addTo(map);

      toMarker = L.marker([toGeo.lat, toGeo.lng], {
        icon: L.divIcon({ className: 'ts-endpoint ts-endpoint-to', html: '<span>B</span>', iconSize: [32, 32], iconAnchor: [16, 16] })
      }).bindPopup(`<b>To:</b> ${toGeo.display}`).addTo(map);

      // Find stops within 50 miles of route line
      const MAX_OFF_ROUTE_MI = 50;
      const candidates = allStops.map(stop => ({
        ...stop,
        distMiles: pointToSegmentMiles({ lat: stop.lat, lng: stop.lng }, fromGeo, toGeo)
      })).filter(s => s.distMiles <= MAX_OFF_ROUTE_MI)
        .sort((a, b) => (b.discount - a.discount) || (a.distMiles - b.distMiles))
        .slice(0, 12);

      // Update markers — show all stops faintly, candidates highlighted
      stopMarkers.forEach(m => map.removeLayer(m));
      stopMarkers = [];
      const candidateIds = new Set(candidates.map(c => c.id));
      allStops.forEach(stop => {
        const m = makeMarker(stop);
        m.__stopId = stop.id;
        m.bindPopup(popupHtml(stop), { maxWidth: 240 });
        if (!candidateIds.has(stop.id)) {
          // dim non-candidates by adding class via custom icon
          const dimIcon = L.divIcon({
            className: 'ts-pin-wrap ts-pin-dim',
            html: `<div class="ts-pin" style="--c:${brandColor(stop.brand)}"><span>$${(3.50 - stop.discount).toFixed(2)}</span></div>`,
            iconSize: [56, 28],
            iconAnchor: [28, 28]
          });
          m.setIcon(dimIcon);
        }
        m.addTo(map);
        stopMarkers.push(m);
      });

      renderStopList(candidates, panelEl);

      // Fit map to route + nearby stops
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
      statusEl.innerHTML = `<strong>${candidates.length}</strong> stops along your <strong>${totalMi}-mile</strong> route · avg discount <strong>${avgDiscount}¢/gal</strong>`;
      statusEl.style.color = '';
    } catch (err) {
      console.error(err);
      statusEl.textContent = err.message || 'Something went wrong. Try again.';
      statusEl.style.color = '#f87171';
    } finally {
      btnEl.disabled = false;
      btnEl.innerHTML = btnEl.dataset.original;
    }
  }

  async function init() {
    // Load truck stops dataset
    try {
      const resp = await fetch('assets/truck-stops.json');
      allStops = await resp.json();
    } catch (e) {
      console.error('Failed to load truck stops:', e);
      return;
    }

    // Initialize map
    map = L.map('fuel-finder-map', {
      center: [39.5, -98.0], // center of US
      zoom: 4,
      scrollWheelZoom: true,
      worldCopyJump: true
    });

    // Dark tile layer (matches site theme)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Show all stops initially
    showAllStops();

    // Wire up form
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

    // Reset button
    const resetBtn = document.getElementById('ff-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        fromInput.value = '';
        toInput.value = '';
        clearRouteVisuals();
        showAllStops();
        panelEl.innerHTML = '<p class="ts-empty">Enter From and To cities to find the cheapest stops along your route.</p>';
        statusEl.innerHTML = `<strong>${allStops.length}</strong> in-network stops loaded across US &amp; Canada`;
        statusEl.style.color = '';
        map.setView([39.5, -98.0], 4);
      });
    }

    // Initial status
    statusEl.innerHTML = `<strong>${allStops.length}</strong> in-network stops loaded across US &amp; Canada`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
