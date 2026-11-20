// GTA 6 Secrets Journal — pin positions on the GTADB community map (v1.0.8).
// Game coordinates (metres) from research/gtadb-pins.json.
// Calibration: reference-map lat/lng -> GTADB game coords, x = 23670.4*lng + 12869.8,
// y = 23953.4*lat - 15887.7 (weighted least squares, 6 anchors; strong-anchor
// residuals 90m/217m; validated visually on the real map). Unmatched entries
// are general-area circles placed from their area text using GTADB landmark
// region centres — never an invented precise position.
// kind: exact = solid pin, approx = dashed ring, area = dashed general-area circle.
// Map: GTA VI Mapping Community / GTADB (CC BY 4.0) — map.gtadb.org.
window.GTA6_MAP = { x0: -12000, y1: 10500, s0: 0.03 };
window.GTA6_PINS = [
  { id: 'places-1', section: 'places', name: "Skunk Ape (Bigfoot) and its effigy", x: -2900, y: -4750, kind: 'area' },
  { id: 'places-2', section: 'places', name: "UFO abduction", x: -5936.3, y: 8001.0, kind: 'approx' },
  { id: 'places-3', section: 'places', name: "Literal Easter egg on the tallest radio tower", x: -2506.5, y: -2263.0, kind: 'exact' },
  { id: 'places-4', section: 'places', name: "Dexter's apartment (Trinity Apartments)", x: 1700, y: 2400, kind: 'area' },
  { id: 'places-5', section: 'places', name: "Paul Walker tribute car (Maibatsu Penumbra FF)", x: 582.5, y: 1377.9, kind: 'exact' },
  { id: 'places-6', section: 'places', name: "Lucky Dog (jet-ski rescue dog)", x: -2700, y: -5900, kind: 'area' },
  { id: 'places-7', section: 'places', name: "Buried alien lab (Abandoned Site)", x: -2800, y: -4200, kind: 'area' },
  { id: 'places-8', section: 'places', name: "San Andreas mystery house", x: -1172, y: 2922, kind: 'area' },
  { id: 'loot-9', section: 'loot', name: "Exotic Animals Front stash (Key Lento)", x: -2411.8, y: -6014.1, kind: 'exact' },
  { id: 'loot-10', section: 'loot', name: "Apollo Aggregates warehouse (drug deal gone wrong)", x: -1919.5, y: -2675.0, kind: 'exact' },
  { id: 'loot-11', section: 'loot', name: "Pelican Valley Crab Research Outpost (crab lab puzzle)", x: -3903.0, y: -4083.5, kind: 'approx' },
  { id: 'loot-12', section: 'loot', name: "Industrial storage building (Hamlet)", x: -2500, y: -3950, kind: 'area' },
  { id: 'loot-13', section: 'loot', name: "Plane crash sites (Grassrivers)", x: -4800, y: -4200, kind: 'area' },
  { id: 'loot-14', section: 'loot', name: "Broken-down vehicle random events", x: -1500, y: 1000, kind: 'area' },
  { id: 'loot-15', section: 'loot', name: "Hidden safes: M7 junkyard (7777) and Kingpin Bowling office (0300)", x: -2440.2, y: -3364.9, kind: 'exact' },
  { id: 'loot-15b', section: 'loot', name: "Hidden safe: Kingpin Bowling office (0300)", x: -6383.7, y: 3449.9, kind: 'exact', parent: 'loot-15' },
  { id: 'treasures-16', section: 'treasures', name: "Shipwreck: Nuestra Se\u00f1ora de la Noche (7 relics)", x: -2800, y: -7100, kind: 'area' },
  { id: 'treasures-17', section: 'treasures', name: "Shipwreck: Nuestra Se\u00f1ora de la \u00c9tica Laxa (5 relics)", x: -4800, y: -7700, kind: 'area' },
  { id: 'treasures-18', section: 'treasures', name: "Shipwreck: Urca de Cinco Torres (6 relics)", x: -2200, y: -7300, kind: 'area' },
  { id: 'treasures-19', section: 'treasures', name: "Shipwreck: Nuestra Se\u00f1ora Lujuriosa (6 relics)", x: -2500, y: -7500, kind: 'area' },
  { id: 'treasures-20', section: 'treasures', name: "Shipwreck: Urca de Santa Sierra (6 relics)", x: -1200, y: -7400, kind: 'area' },
  { id: 'treasures-21', section: 'treasures', name: "Shipwreck: Nuestra Se\u00f1ora del Ocio (10 Gold Doubloons)", x: -900, y: -6100, kind: 'area' },
  { id: 'treasures-22', section: 'treasures', name: "Cocaine Flamingos \u2014 Belpoint cluster (6 in one spot)", x: -8017.0, y: -380.3, kind: 'approx' },
  { id: 'treasures-23', section: 'treasures', name: "Cocaine Flamingos \u2014 Wreck of the Meerwunder beach (3)", x: -5273.6, y: 8494.5, kind: 'exact' },
  { id: 'treasures-24', section: 'treasures', name: "Cocaine Flamingos \u2014 Capri Halloween House garden", x: -6665.4, y: 180.2, kind: 'exact' },
  { id: 'treasures-25', section: 'treasures', name: "Collectible Cards (480 cards, 18 sets)", x: -2500, y: 0, kind: 'area' },
  { id: 'treasures-26', section: 'treasures', name: "'Find the Lost Drugs' side-mission packages (9)", x: -4300, y: -4000, kind: 'area' },
  { id: 'cars-27', section: 'cars', name: "Pegassi Infernus", x: -790.4, y: 934.8, kind: 'exact' },
  { id: 'cars-28', section: 'cars', name: "Pegassi Vitello", x: 745.8, y: 4008.0, kind: 'exact' },
  { id: 'cars-29', section: 'cars', name: "Bravado Gauntlet Hellfire", x: -2454.4, y: -2984.0, kind: 'exact' },
  { id: 'cars-30', section: 'cars', name: "Pegassi Tempesta", x: -1919.5, y: 7368.7, kind: 'exact' },
  { id: 'cars-31', section: 'cars', name: "Declasse Mamba GT", x: 700, y: 2400, kind: 'area' },
  { id: 'cars-32', section: 'cars', name: "Ascot Paragon", x: -1569.1, y: 3732.5, kind: 'exact' },
  { id: 'cars-33', section: 'cars', name: "Piccia Furia", x: -1029.5, y: -2722.9, kind: 'exact' },
  { id: 'cars-34', section: 'cars', name: "Pegassi Toros", x: 85.4, y: -597.7, kind: 'exact' },
  { id: 'cars-35', section: 'cars', name: "Pfister Growler", x: 1950, y: 1200, kind: 'area' },
  { id: 'cars-36', section: 'cars', name: "Bravado Banshee", x: -1578.6, y: -1716.9, kind: 'exact' },
  { id: 'cars-37', section: 'cars', name: "Buckingham Windsor Drop", x: -328.8, y: 2115.7, kind: 'approx' },
  { id: 'cars-38', section: 'cars', name: "Gallivanter Baller ST-D", x: 800, y: 500, kind: 'area' },
  { id: 'cars-39', section: 'cars', name: "Moses' Emperor Sultan (reward car)", x: -800, y: 0, kind: 'area' },
  { id: 'cars-40', section: 'cars', name: "'95 Grotti Cheetah (Ultimate Edition)", x: 85.4, y: -1197.7, kind: 'exact' },
  { id: 'cars-41', section: 'cars', name: "'67 Vapid Dominator Buggy (Ultimate Edition)", x: -5122, y: -3360, kind: 'area' },
  { id: 'cars-42', section: 'cars', name: "'55 Vapid Stanier (pre-order bonus)", x: 1900, y: 1400, kind: 'area' },
];
