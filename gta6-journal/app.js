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
    // deterministic jitter so same-area dots don't stack exactly
    var jx = ((idx * 37) % 5 - 2) * 11;
    var jy = ((idx * 53) % 5 - 2) * 9;
    return { x: Math.max(24, Math.min(976, p.x + jx)), y: Math.max(24, Math.min(616, p.y + jy)) };
  }
  var DOT_COLORS = { places: '#2ee6c8', loot: '#ffc93c', treasures: '#ff2e88', cars: '#b78cff' };

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
    var dots = list.map(function (e, i) {
      var p = dotPos(e, i);
      var cls = found.has(e.id) ? 'map-dot found' : 'map-dot';
      return '<g class="' + cls + '" data-entry="' + e.id + '">' +
        '<circle cx="' + p.x + '" cy="' + p.y + '" r="11" fill="' + DOT_COLORS[e.section] + '"/>' +
        '<text x="' + p.x + '" y="' + (p.y + 4) + '" text-anchor="middle" font-size="11" font-weight="bold" fill="#0d0a14">' + (i + 1) + '</text>' +
        '<title>' + esc(e.name) + '</title></g>';
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
      '<text class="map-label" x="640" y="270">VICE CITY</text>' +
      '<text class="map-label" x="800" y="330">VICE BEACH</text>' +
      '<text class="map-label" x="330" y="545">LEONIDA KEYS</text>' +
      '<text class="map-label" x="180" y="350">GRASSRIVERS</text>' +
      '<text class="map-label" x="430" y="100">MT. KALAGA</text>' +
      '<text class="map-label" x="210" y="130">PORT GELLHORN</text>' +
      '<text class="map-label" x="560" y="500">HAMLET</text>' +
      dots + '</svg>';
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
      return '<article class="entry' + (isFound ? ' found' : '') + '" id="entry-' + e.id + '">' +
        '<div class="entry-top"><input type="checkbox" class="entry-check" data-id="' + e.id + '"' + (isFound ? ' checked' : '') + ' aria-label="Mark found">' +
        '<div><h3>' + (i + 1) + '. ' + esc(e.name) + '</h3>' +
        '<div class="area">' + esc(e.area) + '</div>' +
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
})();
