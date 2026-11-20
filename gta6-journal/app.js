// GTA 6 Secrets Journal — checklist, real community map, section unlocks.
// Web build: locked sections unlock via ?unlock=all (preview only).
// Play build: the Android wrapper calls window.GTA6Journal.setUnlocked(id)
// after a real Play Billing purchase. Prices: Loot / Treasures / Cars $2 each.
(function () {
  'use strict';
  var DATA = window.GTA6_DATA;
  var SECTIONS = DATA.sections;
  var ENTRIES = DATA.entries;
  var LS_FOUND = 'gta6journal_found_v1';
  var LS_UNLOCKED = 'gta6journal_unlocked_v1';
  var PRODUCTS = { loot: 'gta6_journal_loot', treasures: 'gta6_journal_treasures', cars: 'gta6_journal_cars' };

  var found = new Set(JSON.parse(localStorage.getItem(LS_FOUND) || '[]'));
  var unlocked = new Set(JSON.parse(localStorage.getItem(LS_UNLOCKED) || '[]'));
  if (/[?&]unlock=all/.test(location.search)) {
    SECTIONS.forEach(function (s) { if (s.price > 0) unlocked.add(s.id); });
    saveUnlocked();
  }
  var active = 'places';
  var query = '';
  var view = 'map'; // 'map' is the main screen; 'list' is the entry list
  var sheetEntry = null; // entry id currently open in the detail sheet

  function saveFound() { localStorage.setItem(LS_FOUND, JSON.stringify(Array.from(found))); }
  function saveUnlocked() { localStorage.setItem(LS_UNLOCKED, JSON.stringify(Array.from(unlocked))); }
  function isUnlocked(id) {
    var s = SECTIONS.find(function (x) { return x.id === id; });
    return !s || s.price === 0 || unlocked.has(id);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var DOT_COLORS = { places: '#2ee6c8', loot: '#ffc93c', treasures: '#ff2e88', cars: '#b78cff' };
  // Pin positions live in pins.js (window.GTA6_PINS): game coords (metres) on
  // the GTADB community map. kind: 'exact' solid pin, 'approx' dashed ring,
  // 'area' dashed general-area circle. loot-15 has two pins (two safes).

  function renderTabs() {
    var nav = document.getElementById('tabs');
    nav.innerHTML = SECTIONS.map(function (s) {
      var n = ENTRIES.filter(function (e) { return e.section === s.id; }).length;
      var f = ENTRIES.filter(function (e) { return e.section === s.id && found.has(e.id); }).length;
      var lock = s.price > 0 && !unlocked.has(s.id)
        ? ' <span class="lock">🔒 $' + s.price.toFixed(2) + '</span>' : '';
      return '<button class="tab' + (active === s.id ? ' active' : '') + '" data-section="' + s.id + '">' +
        s.icon + ' ' + esc(s.title) + lock + '<small>' + f + ' / ' + n + ' found</small></button>';
    }).join('');
    nav.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { active = b.dataset.section; render(); });
    });
  }

  // ---- the real community map (Leaflet + self-hosted GTADB tiles) ----
  // The map is the main screen. Only sections the user can open get pins:
  // Secret Places (free) always, and a paid section's pins appear only
  // once that section is unlocked. Locked pins are never added to the map
  // at all — no dot, no ring, no unlock prompt from the map. 43 dots for
  // 42 entries when everything is unlocked (loot-15 has two locations).
  var leafletMap = null;
  var leafletMarkers = {}; // entry id -> [marker, ...]
  var leafletPinKeys = {}; // pin id (GTA6_PINS id) -> marker

  function pinLatLng(p) {
    // CRS.Simple: pixel y grows downward, so a world pixel (px, py) is
    // latlng [-py, px]. (Leaflet's unproject does the same, but this is explicit.)
    var M = window.GTA6_MAP;
    return L.latLng(-(M.y1 - p.y) * M.s0, (p.x - M.x0) * M.s0);
  }
  function pinIcon(d) {
    var cls = 'map-dot ' + d.kind + (found.has(d.id) ? ' found' : '');
    var color = DOT_COLORS[d.section];
    var inner;
    if (d.kind === 'exact') inner = '<span class="dot-solid" style="background:' + color + '">' + d.num + '</span>';
    else if (d.kind === 'approx') inner = '<span class="dot-approx" style="color:' + color + '">' + d.num + '</span>';
    else inner = '<span class="dot-area" style="color:' + color + '">' + d.num + '</span>';
    return L.divIcon({
      className: 'map-dot-icon',
      html: '<div class="' + cls + '" data-entry="' + d.id + '" title="' + esc(d.name) + '">' + inner + '</div>',
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
  }
  function initLeaflet() {
    var M = window.GTA6_MAP;
    var W = 17000 * M.s0, H = 21000 * M.s0; // world size in px at zoom 0
    // CRS.Simple puts the origin at the top-left with latitude NEGATIVE
    // going down, so the world bounds are [[-H, 0], [0, W]].
    var bounds = [[-H, 0], [0, W]];
    leafletMap = L.map('mapViewport', {
      crs: L.CRS.Simple,
      minZoom: 0, maxZoom: 4,
      zoomSnap: 0.25, zoomDelta: 0.5,
      zoomControl: false, attributionControl: false,
      maxBounds: [[-H - 80, -80], [80, W + 80]],
      maxBoundsViscosity: 0.8
    });
    L.tileLayer('tiles/{z}/{x}/{y}.jpg', {
      tileSize: 512, minZoom: 0, maxZoom: 4, bounds: bounds, noWrap: true
    }).addTo(leafletMap);
    leafletMap.fitBounds(bounds);
    syncMapMarkers();
  }
  // Add pins for sections the user can open; remove pins for locked ones.
  // Called on every render, so a purchase (setUnlocked) or a revocation
  // (setLocked) updates the map live, without a reload.
  function syncMapMarkers() {
    if (!leafletMap) return;
    window.GTA6_PINS.forEach(function (p) {
      var e = ENTRIES.find(function (x) { return x.id === p.id; }) ||
              ENTRIES.find(function (x) { return x.id === (p.parent || ''); });
      if (!e) return;
      var marker = leafletPinKeys[p.id];
      if (isUnlocked(e.section)) {
        if (!marker) {
          // number = index of the entry within its section (loot-15's two pins share it)
          var idx = ENTRIES.filter(function (x) { return x.section === e.section; })
            .findIndex(function (x) { return x.id === e.id; }) + 1;
          var d = { id: e.id, num: idx, section: e.section, name: e.name, kind: p.kind };
          marker = L.marker(pinLatLng(p), { icon: pinIcon(d), title: e.name });
          marker.on('click', function () { openDetail(e.id); });
          marker.addTo(leafletMap);
          leafletPinKeys[p.id] = marker;
          (leafletMarkers[e.id] = leafletMarkers[e.id] || []).push(marker);
        }
      } else if (marker) {
        // Section locked (or revoked): remove the pin from the map entirely.
        leafletMap.removeLayer(marker);
        delete leafletPinKeys[p.id];
        var arr = leafletMarkers[e.id] || [];
        var i = arr.indexOf(marker);
        if (i !== -1) arr.splice(i, 1);
      }
    });
    // Refresh found-state classes (a check or purchase can change them).
    Object.keys(leafletMarkers).forEach(function (id) {
      leafletMarkers[id].forEach(function (m) {
        var el = m.getElement();
        if (!el) return;
        var dot = el.querySelector('.map-dot');
        if (dot) dot.classList.toggle('found', found.has(id));
      });
    });
  }
  function renderMap() {
    if (!window.L || !window.GTA6_PINS) {
      document.getElementById('mapViewport').innerHTML =
        '<p class="map-error">Map failed to load. Check your connection and reopen the app.</p>';
      return;
    }
    if (!leafletMap) { initLeaflet(); return; }
    syncMapMarkers();
  }

  // One entry card, used by the list view and by the pin detail sheet.
  function entryCardHtml(e, i, idAttr) {
    var isFound = found.has(e.id);
    var badge = e.verified
      ? '<span class="badge verified">✓ Verified — 2+ guides agree</span>'
      : '<span class="badge single">⚠ Single source — unconfirmed</span>';
    var sketch = (window.GTA6_SKETCHES || {})[e.id] || '';
    var photo = '<div class="spot-photo"><img src="spot-photos/' + e.id + '.jpg" alt="Photo-style image: ' + esc(e.name) + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'">' +
      '<p class="spot-photo-cap">Photo-style image — original art, not an in-game screenshot · tap to zoom</p></div>';
    return '<article class="entry' + (isFound ? ' found' : '') + '" id="' + idAttr + '">' +
      '<div class="entry-top"><input type="checkbox" class="entry-check" data-id="' + e.id + '"' + (isFound ? ' checked' : '') + ' aria-label="Mark found">' +
      '<div><h3>' + (i + 1) + '. ' + esc(e.name) + '</h3>' +
      '<div class="area">' + esc(e.area) + '</div>' +
      (e.note ? '<p class="entry-note warn">⚠ ' + esc(e.note) + '</p>' : '') +
      photo +
      (sketch ? '<div class="sketch">' + sketch +
        '<p class="sketch-cap">Sketch — schematic, not to scale · tap to zoom</p></div>' : '') +
      '<p><b>Where:</b> ' + esc(e.location) + '</p>' +
      '<p><b>How to get it:</b> ' + esc(e.how) + '</p>' + badge + '</div></div></article>';
  }

  function renderEntries() {
    var wrap = document.getElementById('entries');
    var lockPanel = document.getElementById('lockPanel');
    var sec = SECTIONS.find(function (s) { return s.id === active; });
    var list = ENTRIES.filter(function (e) { return e.section === active; });
    if (query) {
      var q = query.toLowerCase();
      list = list.filter(function (e) {
        return (e.name + ' ' + e.area + ' ' + e.location).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (!isUnlocked(active)) {
      wrap.innerHTML = '';
      lockPanel.hidden = false;
      document.getElementById('lockTitle').textContent = '🔒 ' + sec.title + ' — $' + sec.price.toFixed(2);
      document.getElementById('lockText').textContent =
        'Unlock all ' + ENTRIES.filter(function (e) { return e.section === active; }).length +
        ' ' + sec.title.toLowerCase() + ' entries with locations and how to get each one. One-time purchase, yours forever.';
      document.getElementById('lockFine').textContent =
        'Unlocks are purchased in the Play Store app. Web preview: add ?unlock=all to the URL to preview unlocked sections.';
      return;
    }
    lockPanel.hidden = true;
    var done = ENTRIES.filter(function (e) { return e.section === active && found.has(e.id); }).length;
    var total = ENTRIES.filter(function (e) { return e.section === active; }).length;
    var html = '<p class="section-progress">' + sec.icon + ' ' + esc(sec.title) + ' — ' + done + ' / ' + total + ' found</p>';
    if (!list.length) html += '<p class="empty">No secrets match that search in this section.</p>';
    html += list.map(function (e, i) { return entryCardHtml(e, i, 'entry-' + e.id); }).join('');
    wrap.innerHTML = html;
  }

  function renderProgress() {
    var total = ENTRIES.length, done = found.size;
    document.getElementById('overallCount').textContent = done + ' / ' + total + ' found';
    var pct = total ? Math.round(done / total * 100) : 0;
    document.getElementById('overallPct').textContent = pct + '%';
    document.getElementById('overallFill').style.width = pct + '%';
  }

  function render() {
    renderTabs(); renderMap(); renderEntries(); renderProgress();
    // A purchase can happen while the detail sheet is open (unlock from the
    // sheet) — refresh its content so the locked entry opens unlocked.
    if (sheetEntry && !document.getElementById('detailSheet').hidden) openDetail(sheetEntry);
  }

  // ---- pin detail sheet (bottom sheet; opens when a map dot is tapped) ----
  function openDetail(id) {
    var e = ENTRIES.find(function (x) { return x.id === id; });
    if (!e) return;
    sheetEntry = id;
    var body = document.getElementById('sheetBody');
    if (!isUnlocked(e.section)) {
      var sec = SECTIONS.find(function (s) { return s.id === e.section; });
      var n = ENTRIES.filter(function (x) { return x.section === e.section; }).length;
      body.innerHTML = '<div class="sheet-lock"><div class="lock-icon" aria-hidden="true">🔒</div>' +
        '<h2>' + esc(sec.title) + ' — $' + sec.price.toFixed(2) + '</h2>' +
        '<p><b>' + esc(e.name) + '</b> is in the locked ' + esc(sec.title) + ' section.</p>' +
        '<p>Unlock all ' + n + ' ' + esc(sec.title.toLowerCase()) + ' entries with locations and how to get each one. One-time purchase, yours forever.</p>' +
        '<button class="unlock-btn" data-section="' + sec.id + '">Unlock for $' + sec.price.toFixed(2) + '</button>' +
        '<p class="lock-fine">Unlocks are purchased in the Play Store app. Web preview: add ?unlock=all to the URL to preview unlocked sections.</p></div>';
    } else {
      var idx = ENTRIES.filter(function (x) { return x.section === e.section; })
        .findIndex(function (x) { return x.id === id; });
      body.innerHTML = entryCardHtml(e, idx, 'sheet-entry-' + e.id);
    }
    document.getElementById('sheetBackdrop').hidden = false;
    document.getElementById('detailSheet').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeDetail() {
    sheetEntry = null;
    document.getElementById('sheetBackdrop').hidden = true;
    document.getElementById('detailSheet').hidden = true;
    if (document.getElementById('zoomOverlay').hidden) document.body.style.overflow = '';
  }

  // ---- map / list view toggle (map is the main screen) ----
  function setView(v) {
    view = v;
    var mapCard = document.getElementById('mapCard');
    var listView = document.getElementById('listView');
    var btn = document.getElementById('viewToggle');
    if (v === 'map') {
      mapCard.hidden = false; listView.hidden = true;
      btn.textContent = '☰ List view';
      renderMap();
      if (leafletMap) leafletMap.invalidateSize();
    } else {
      mapCard.hidden = true; listView.hidden = false;
      btn.textContent = '🗺️ Map view';
      renderEntries();
    }
    window.scrollTo(0, 0);
  }

  // One purchase path for the lock panel and the detail sheet.
  function unlockSection(sectionId) {
    toast('Unlocks are purchased in the Play Store app ($2.00 per section). Web preview: add ?unlock=all to the URL.');
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  document.getElementById('search').addEventListener('input', function (ev) {
    query = ev.target.value;
    renderEntries();
  });
  document.getElementById('unlockBtn').addEventListener('click', function () {
    unlockSection(active);
  });
  document.getElementById('viewToggle').addEventListener('click', function () {
    setView(view === 'map' ? 'list' : 'map');
  });
  document.getElementById('sheetClose').addEventListener('click', closeDetail);
  document.getElementById('sheetBackdrop').addEventListener('click', closeDetail);
  document.getElementById('sheetBody').addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('.unlock-btn') : null;
    if (b) unlockSection(b.dataset.section);
  });

  // One checkbox handler for the list view and the detail sheet. Updates
  // state in place — no full re-render, so the map keeps its zoom/pan.
  document.addEventListener('change', function (ev) {
    var cb = ev.target.closest ? ev.target.closest('.entry-check') : null;
    if (!cb) return;
    var id = cb.dataset.id;
    if (cb.checked) found.add(id); else found.delete(id);
    saveFound();
    renderProgress();
    renderTabs();
    document.querySelectorAll('.map-dot[data-entry="' + id + '"]').forEach(function (g) {
      g.classList.toggle('found', cb.checked);
    });
    var card = cb.closest('.entry');
    if (card) card.classList.toggle('found', cb.checked);
    var listCard = document.getElementById('entry-' + id);
    if (listCard && listCard !== card) listCard.classList.toggle('found', cb.checked);
  });

  // ---- map controls: zoom buttons, reset, full-screen (Leaflet) ----
  // Pinch/scroll zoom and drag pan are native to Leaflet. The +/−/Reset
  // buttons call the map directly; the full-screen button pins the map
  // to the viewport (same map instance, invalidateSize on toggle).
  function initMapControls() {
    document.getElementById('mapZoomIn').addEventListener('click', function () { if (leafletMap) leafletMap.zoomIn(); });
    document.getElementById('mapZoomOut').addEventListener('click', function () { if (leafletMap) leafletMap.zoomOut(); });
    document.getElementById('mapZoomReset').addEventListener('click', function () {
      if (!leafletMap) return;
      var M = window.GTA6_MAP;
      leafletMap.fitBounds([[-21000 * M.s0, 0], [0, 17000 * M.s0]]);
    });
    document.getElementById('mapZoomFull').addEventListener('click', function () {
      document.getElementById('mapWrap').classList.toggle('map-fullscreen');
      if (leafletMap) setTimeout(function () { leafletMap.invalidateSize(); }, 50);
    });
  }

  // ---- full-screen zoom viewer for the main map and per-entry sketches ----
  var zoomOverlay = document.getElementById('zoomOverlay');
  var zoomStage = document.getElementById('zoomStage');
  var zoomContent = null;
  var zScale = 1, zX = 0, zY = 0;
  var zPointers = new Map();
  var zPinch = null; // { d0, s0, x0, y0 }
  var zMoved = 0, zDownBackdrop = false;

  function zClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function zApply() {
    if (zoomContent) zoomContent.style.transform = 'translate(' + zX + 'px,' + zY + 'px) scale(' + zScale + ')';
  }
  function zClampPan() {
    var mx = zoomStage.clientWidth, my = zoomStage.clientHeight;
    zX = zClamp(zX, -mx, mx); zY = zClamp(zY, -my, my);
  }
  function zZoomAt(cx, cy, factor) {
    var ns = zClamp(zScale * factor, 1, 6);
    zX = cx - (cx - zX) * (ns / zScale);
    zY = cy - (cy - zY) * (ns / zScale);
    zScale = ns; zClampPan(); zApply();
  }
  function zReset() { zScale = 1; zX = 0; zY = 0; zApply(); }
  function zOpen(svgHtml, kind) {
    zoomStage.innerHTML = '<div class="zoom-content ' + kind + '">' + svgHtml + '</div>';
    zoomContent = zoomStage.firstChild;
    zReset();
    zoomOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function zClose() {
    zoomOverlay.hidden = true;
    zoomStage.innerHTML = ''; zoomContent = null;
    if (document.getElementById('detailSheet').hidden) document.body.style.overflow = '';
  }
  function zStageCenter(ev) {
    var r = zoomStage.getBoundingClientRect();
    return { x: ev.clientX - (r.left + r.width / 2), y: ev.clientY - (r.top + r.height / 2) };
  }
  function initZoom() {
    document.getElementById('zoomClose').addEventListener('click', zClose);
    document.getElementById('zoomIn').addEventListener('click', function () { zZoomAt(0, 0, 1.5); });
    document.getElementById('zoomOut').addEventListener('click', function () { zZoomAt(0, 0, 1 / 1.5); });
    document.getElementById('zoomReset').addEventListener('click', zReset);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!document.getElementById('detailSheet').hidden) { closeDetail(); return; }
      if (!zoomOverlay.hidden) zClose();
    });
    zoomStage.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var c = zStageCenter(ev);
      zZoomAt(c.x, c.y, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    zoomStage.addEventListener('pointerdown', function (ev) {
      zDownBackdrop = (ev.target === zoomStage);
      zMoved = 0;
      try { zoomStage.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic events */ }
      zPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (zPointers.size === 2) {
        var pts = Array.from(zPointers.values());
        zPinch = { d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), s0: zScale, x0: zX, y0: zY };
      }
    });
    zoomStage.addEventListener('pointermove', function (ev) {
      if (!zPointers.has(ev.pointerId)) return;
      var prev = zPointers.get(ev.pointerId);
      zMoved += Math.abs(ev.clientX - prev.x) + Math.abs(ev.clientY - prev.y);
      zPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (zPointers.size === 1) {
        var dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
        zX += dx; zY += dy; zClampPan(); zApply();
      } else if (zPointers.size === 2 && zPinch) {
        var pts = Array.from(zPointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
        var r = zoomStage.getBoundingClientRect();
        var cx = mx - (r.left + r.width / 2), cy = my - (r.top + r.height / 2);
        var ns = zClamp(zPinch.s0 * (d / zPinch.d0), 1, 6);
        zX = cx - (cx - zPinch.x0) * (ns / zPinch.s0);
        zY = cy - (cy - zPinch.y0) * (ns / zPinch.s0);
        zScale = ns; zClampPan(); zApply();
      }
    });
    function zEnd(ev) {
      zPointers.delete(ev.pointerId);
      if (zPointers.size < 2) zPinch = null;
      if (zPointers.size === 0 && zDownBackdrop && zMoved < 8) zClose();
    }
    zoomStage.addEventListener('pointerup', zEnd);
    zoomStage.addEventListener('pointercancel', zEnd);
    // Tap any entry sketch or spot photo to zoom it (list view or sheet).
    function zoomTargetClick(ev) {
      var sk = ev.target.closest ? ev.target.closest('.sketch') : null;
      if (sk) {
        var svg = sk.querySelector('svg');
        if (svg) zOpen(svg.outerHTML, 'sketch');
        return;
      }
      var ph = ev.target.closest ? ev.target.closest('.spot-photo') : null;
      if (ph) {
        var img = ph.querySelector('img');
        if (img) zOpen('<img src="' + img.getAttribute('src') + '" alt="">', 'photo');
      }
    }
    document.getElementById('entries').addEventListener('click', zoomTargetClick);
    document.getElementById('sheetBody').addEventListener('click', zoomTargetClick);
  }

  // Bridge for the Android wrapper (Play Billing). The wrapper calls
  // window.GTA6Journal.setUnlocked('loot' | 'treasures' | 'cars') after purchase.
  window.GTA6Journal = {
    setUnlocked: function (id) {
      if (PRODUCTS[id]) { unlocked.add(id); saveUnlocked(); render(); return true; }
      return false;
    },
    isUnlocked: isUnlocked,
    getFoundCount: function () { return found.size; },
    products: PRODUCTS
  };

  render();
  initMapControls();
  initZoom();
})();
