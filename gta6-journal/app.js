// GTA 6 Secrets Journal — checklist, schematic map, section unlocks.
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

  // ---- schematic map anchors (approximate area positions; not to scale) ----
  var ANCHORS = [
    ['vice beach', 820, 300], ['ocean beach', 820, 320], ['leaf links', 800, 270],
    ['starfish island', 800, 470], ['catalan bay', 800, 470], ['capri', 880, 170],
    ['vespucci', 880, 270], ['washington island', 740, 170], ['tequesta', 720, 210],
    ['peacock', 830, 370], ['crosstown', 680, 270], ['downtown', 690, 300],
    ['vice city', 700, 290], ['belville', 770, 210], ['waning sands', 840, 440],
    ['leonard county', 830, 430], ['leonida keys', 420, 560], ['key lento', 400, 560],
    ['abismo key', 470, 580], ['featherstone', 340, 600], ['belpoint', 170, 560],
    ['gambit bay', 520, 540], ['grassrivers', 200, 360], ['cottonmouth', 230, 330],
    ['pelican valley', 280, 500], ['mariana county', 300, 400], ['port gellhorn', 250, 140],
    ['kelly county', 350, 190], ['mount kalaga', 480, 110], ['hamlet', 590, 470],
    ['south vice-dale', 600, 440], ['vice-dale', 620, 420]
  ];
  function anchorFor(entry) {
    var a = (entry.area + ' ' + entry.location).toLowerCase();
    for (var i = 0; i < ANCHORS.length; i++) {
      if (a.indexOf(ANCHORS[i][0]) !== -1) return { x: ANCHORS[i][1], y: ANCHORS[i][2] };
    }
    return { x: 500, y: 320 };
  }
  function dotPos(entry, idx) {
    var p = anchorFor(entry);
    // deterministic jitter so same-area dots don't stack exactly.
    // Modulus 7 (not 5): the old modulus-5 jitter repeated every 5 entries,
    // so treasures-16 and treasures-21 landed on the exact same point and
    // one dot was completely hidden. Dots stay within ~25px of their anchor.
    var jx = ((idx * 37) % 7 - 3) * 8;
    var jy = ((idx * 53) % 7 - 3) * 7;
    return { x: Math.max(24, Math.min(976, p.x + jx)), y: Math.max(24, Math.min(616, p.y + jy)) };
  }
  var DOT_COLORS = { places: '#2ee6c8', loot: '#ffc93c', treasures: '#ff2e88', cars: '#b78cff' };

  // ---- IGN-matched pin positions (v1.0.4) ----
  // From research/ign-matches.json (IGN MapGenie coords, matched 2026-11-20).
  // Linear transform into the schematic's 1000x640 space:
  //   x = 1527.6 * lng + 1517.9   (anchored on Belpoint lighthouse <-> Vice Beach bar)
  //   y = -865.4 * lat + 909.4    (anchored on mainland south coast <-> north edge)
  // The schematic is stylised, not a projection: its west (Grassrivers) is
  // drawn compressed, so three western pins are hand-placed on their region
  // shapes instead (marked HAND). kind: 'exact' = solid pin (high+medium
  // confidence), 'approx' = dashed-ring pin (low confidence). Entries not
  // listed here keep the anchor-based dashed "general area" circle.
  var IGN_PINS = {
    'places-2': [{ x: 304, y: 46, kind: 'approx' }],          // UFO debris field (low)
    'places-3': [{ x: 526, y: 417, kind: 'exact' }],          // Bluegrass Antenna Mast (med)
    'places-5': [{ x: 880, y: 270, kind: 'exact' }],          // Vespucci Mansion — HAND: on the drawn Vespucci island ellipse (med)
    'loot-9': [{ x: 532, y: 553, kind: 'exact' }],            // Exotic Animals Front, Key Lento (high)
    'loot-10': [{ x: 568, y: 435, kind: 'exact' }],           // Apollo warehouse (med)
    'loot-11': [{ x: 330, y: 495, kind: 'approx' }],          // Crab outpost airboat — HAND: SW swamps north of the Keys (low)
    'loot-15': [{ x: 530, y: 457, kind: 'exact' },            // M7 junkyard safe (high)
                { x: 275, y: 211, kind: 'exact' }],           // Kingpin Bowling safe (high)
    'treasures-22': [{ x: 185, y: 552, kind: 'approx' }],     // Belpoint flamingos — HAND: SE side of drawn Belpoint island (low)
    'treasures-23': [{ x: 340, y: 34, kind: 'exact' }],       // Wreck of the Meerwunder — HAND: on the Featherstone island (high)
    'cars-27': [{ x: 636, y: 302, kind: 'exact' }],           // Infernus (high)
    'cars-28': [{ x: 736, y: 191, kind: 'exact' }],           // Vitello (high)
    'cars-29': [{ x: 529, y: 458, kind: 'exact' }],           // Gauntlet Hellfire (high)
    'cars-30': [{ x: 563, y: 78, kind: 'exact' }],            // Tempesta — nudged onto the mainland's north edge (med)
    'cars-32': [{ x: 586, y: 201, kind: 'exact' }],           // Paragon (med)
    'cars-33': [{ x: 621, y: 434, kind: 'exact' }],           // Furia (high)
    'cars-34': [{ x: 677, y: 368, kind: 'exact' }],           // Toros — shared Pegassi Residences proxy pin, offset -16 (med)
    'cars-36': [{ x: 585, y: 397, kind: 'exact' }],           // Banshee (high)
    'cars-37': [{ x: 666, y: 259, kind: 'approx' }],          // Windsor (low)
    'cars-40': [{ x: 709, y: 368, kind: 'exact' }]            // Cheetah — shared Pegassi Residences proxy pin, offset +16 (med)
  };

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

  function renderMap() {
    var list = ENTRIES.filter(function (e) { return e.section === active; });
    var dots = [];
    list.forEach(function (e, i) {
      var pins = IGN_PINS[e.id];
      if (pins) {
        pins.forEach(function (p) {
          dots.push({ id: e.id, num: i + 1, x: p.x, y: p.y, kind: p.kind, section: e.section, name: e.name });
        });
      } else {
        // No IGN match: dashed "general area" circle at the anchor position.
        var p = dotPos(e, i);
        dots.push({ id: e.id, num: i + 1, x: p.x, y: p.y, kind: 'area', section: e.section, name: e.name });
      }
    });
    var dotsSvg = dots.map(function (d) {
      var cls = 'map-dot ' + d.kind + (found.has(d.id) ? ' found' : '');
      var color = DOT_COLORS[d.section];
      var body;
      if (d.kind === 'exact') {
        body = '<circle cx="' + d.x + '" cy="' + d.y + '" r="11" fill="' + color + '"/>' +
          '<text x="' + d.x + '" y="' + (d.y + 4) + '" text-anchor="middle" font-size="11" font-weight="bold" fill="#0d0a14">' + d.num + '</text>';
      } else if (d.kind === 'approx') {
        body = '<circle cx="' + d.x + '" cy="' + d.y + '" r="12" fill="' + color + '" fill-opacity="0.25" stroke="' + color + '" stroke-width="2.5" stroke-dasharray="5 4"/>' +
          '<text x="' + d.x + '" y="' + (d.y + 4) + '" text-anchor="middle" font-size="11" font-weight="bold" fill="' + color + '">' + d.num + '</text>';
      } else { // area
        body = '<circle cx="' + d.x + '" cy="' + d.y + '" r="13" fill="' + color + '" fill-opacity="0.08" stroke="' + color + '" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.85"/>' +
          '<text x="' + d.x + '" y="' + (d.y + 4) + '" text-anchor="middle" font-size="11" font-weight="bold" fill="' + color + '" opacity="0.85">' + d.num + '</text>';
      }
      return '<g class="' + cls + '" data-entry="' + d.id + '">' + body +
        '<title>' + esc(d.name) + '</title></g>';
    }).join('');
    document.getElementById('mapWrap').innerHTML =
      '<svg viewBox="0 0 1000 640" role="img" aria-label="Schematic map of Leonida">' +
      '<rect width="1000" height="640" fill="#0a2036"/>' +
      // mainland (stylised)
      '<path d="M120,180 L180,110 L300,80 L470,70 L620,90 L760,110 L880,150 L920,230 L900,330 L860,430 L760,500 L600,520 L420,500 L260,470 L150,400 L110,300 Z" fill="#1d4a33" stroke="#2ee6c8" stroke-opacity=".35"/>' +
      // keys chain + islands
      '<ellipse cx="300" cy="570" rx="60" ry="14" fill="#3a5a3a"/><ellipse cx="420" cy="585" rx="70" ry="14" fill="#3a5a3a"/><ellipse cx="540" cy="575" rx="55" ry="12" fill="#3a5a3a"/>' +
      '<ellipse cx="170" cy="560" rx="34" ry="20" fill="#3a5a3a"/><ellipse cx="340" cy="610" rx="30" ry="14" fill="#3a5a3a"/>' +
      '<ellipse cx="880" cy="170" rx="26" ry="34" fill="#3a5a3a"/><ellipse cx="880" cy="270" rx="20" ry="26" fill="#3a5a3a"/><ellipse cx="800" cy="470" rx="24" ry="16" fill="#3a5a3a"/>' +
      // Featherstone Islands (far north; added v1.0.4 for the Meerwunder pin)
      '<ellipse cx="370" cy="34" rx="50" ry="15" fill="#3a5a3a"/>' +
      '<text class="map-label" x="425" y="38">FEATHERSTONE</text>' +
      '<text class="map-label" x="640" y="270">VICE CITY</text>' +
      '<text class="map-label" x="800" y="330">VICE BEACH</text>' +
      '<text class="map-label" x="330" y="545">LEONIDA KEYS</text>' +
      '<text class="map-label" x="180" y="350">GRASSRIVERS</text>' +
      '<text class="map-label" x="430" y="100">MT. KALAGA</text>' +
      '<text class="map-label" x="210" y="130">PORT GELLHORN</text>' +
      '<text class="map-label" x="560" y="500">HAMLET</text>' +
      dotsSvg + '</svg>';
    document.querySelectorAll('.map-dot').forEach(function (g) {
      g.addEventListener('click', function () {
        var card = document.getElementById('entry-' + g.dataset.entry);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.outline = '2px solid ' + DOT_COLORS[active];
          setTimeout(function () { card.style.outline = ''; }, 1600);
        }
      });
    });
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
    html += list.map(function (e, i) {
      var isFound = found.has(e.id);
      var badge = e.verified
        ? '<span class="badge verified">✓ Verified — 2+ guides agree</span>'
        : '<span class="badge single">⚠ Single source — unconfirmed</span>';
      var sketch = (window.GTA6_SKETCHES || {})[e.id] || '';
      return '<article class="entry' + (isFound ? ' found' : '') + '" id="entry-' + e.id + '">' +
        '<div class="entry-top"><input type="checkbox" class="entry-check" data-id="' + e.id + '"' + (isFound ? ' checked' : '') + ' aria-label="Mark found">' +
        '<div><h3>' + (i + 1) + '. ' + esc(e.name) + '</h3>' +
        '<div class="area">' + esc(e.area) + '</div>' +
        (e.note ? '<p class="entry-note warn">⚠ ' + esc(e.note) + '</p>' : '') +
        (sketch ? '<div class="sketch">' + sketch +
          '<p class="sketch-cap">Sketch — schematic, not to scale · tap to zoom</p></div>' : '') +
        '<p><b>Where:</b> ' + esc(e.location) + '</p>' +
        '<p><b>How to get it:</b> ' + esc(e.how) + '</p>' + badge + '</div></div></article>';
    }).join('');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.entry-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.checked) found.add(cb.dataset.id); else found.delete(cb.dataset.id);
        saveFound();
        render();
      });
    });
  }

  function renderProgress() {
    var total = ENTRIES.length, done = found.size;
    document.getElementById('overallCount').textContent = done + ' / ' + total + ' found';
    var pct = total ? Math.round(done / total * 100) : 0;
    document.getElementById('overallPct').textContent = pct + '%';
    document.getElementById('overallFill').style.width = pct + '%';
  }

  function render() { renderTabs(); renderMap(); renderEntries(); renderProgress(); }

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
    toast('Unlocks are purchased in the Play Store app ($2.00 per section). Web preview: add ?unlock=all to the URL.');
  });

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
    document.body.style.overflow = '';
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
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !zoomOverlay.hidden) zClose(); });
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
    // Tap the main map (anywhere except a dot) to zoom it.
    document.getElementById('mapWrap').addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('.map-dot')) return;
      var svg = document.querySelector('#mapWrap svg');
      if (svg) zOpen(svg.outerHTML, 'map');
    });
    // Tap any entry sketch to zoom it.
    document.getElementById('entries').addEventListener('click', function (ev) {
      var sk = ev.target.closest ? ev.target.closest('.sketch') : null;
      if (!sk) return;
      var svg = sk.querySelector('svg');
      if (svg) zOpen(svg.outerHTML, 'sketch');
    });
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
  initZoom();
})();
