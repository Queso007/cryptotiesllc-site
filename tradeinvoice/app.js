'use strict';
/* =====================================================================
   TradeInvoice v1 — estimates & invoices for tradespeople
   Single-file vanilla JS app. Data lives in localStorage only.
   ===================================================================== */

/* ---- MONETIZATION HOOK (Pro upgrades) -------------------------------
   To wire real payments later, paste your Stripe Checkout URL or
   Stripe Payment Link below. Until then the Upgrade button shows a
   "not connected yet" message and NO payment is attempted.
   Example: const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/xxxx';
--------------------------------------------------------------------- */
const STRIPE_CHECKOUT_URL = ''; // <-- TODO: paste Stripe Checkout / Payment Link here

const FREE_DOCS_PER_MONTH = 3;
const LS_KEY = 'tradeInvoiceApp.v1';
const PRO_PRICE_LABEL = '$9.99/month';

/* ---------------- utils ---------------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const money = (n) => '$' + num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const monthKey = (iso) => String(iso || '').slice(0, 7);
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ---------------- state ---------------- */
let state = null;
const ui = { view: 'dashboard', docFilter: 'all', docSearch: '', clientSearch: '', viewingDocId: null, editingDocId: null };
let confirmCallback = null;

function defaultState() {
  return {
    profile: {
      businessName: '', ownerName: '', phone: '', email: '', address: '',
      logo: '', taxRate: 6, dueDays: 14,
      paymentTerms: 'Payment due within 14 days of invoice date.\nThank you for your business!'
    },
    clients: [],
    docs: [],
    counters: { estimate: 1001, invoice: 1001 },
    pro: false,
    seeded: false
  };
}

function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { toast('Could not save — browser storage is full. Export a backup!'); } }
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (parsed && Array.isArray(parsed.docs) && Array.isArray(parsed.clients)) return parsed; }
  } catch (e) { /* corrupted storage -> reseed */ }
  return null;
}

/* ---------------- sample data (first run) ---------------- */
function seed() {
  state = defaultState();
  state.profile = {
    businessName: 'Rivera Plumbing & Heating',
    ownerName: 'Jose Rivera',
    phone: '(570) 555-0148',
    email: 'jose@riveraplumbing.com',
    address: '53 Reliance Dr\nWilkes-Barre, PA 18702',
    logo: '', taxRate: 6, dueDays: 14,
    paymentTerms: 'Payment due within 14 days of invoice date.\nThank you for your business!'
  };
  state.clients = [
    { id: uid(), name: 'Maria Gonzalez', phone: '(570) 555-0112', email: 'maria.g@email.com', address: '212 Carey Ave\nWilkes-Barre, PA 18702', sample: true },
    { id: uid(), name: 'James Carter — Carter Property Mgmt', phone: '(570) 555-0187', email: 'jcarter@propertymgmt.com', address: '88 S Main St\nWilkes-Barre, PA 18701', sample: true }
  ];
  const maria = state.clients[0].id, james = state.clients[1].id;
  state.docs = [
    {
      id: uid(), type: 'estimate', number: 'EST-1001', clientId: maria,
      date: '2026-11-10', dueDate: '2026-12-10', status: 'sent',
      items: [
        { desc: 'Bathroom faucet replacement', qty: 2, price: 85, kind: 'labor' },
        { desc: 'Delta kitchen faucet', qty: 1, price: 124.99, kind: 'materials' },
        { desc: 'Supply lines & fittings', qty: 1, price: 28.5, kind: 'materials' }
      ],
      discount: 0, discountType: 'percent', taxEnabled: true, taxRate: 6,
      amountPaid: 0, paidAt: '', notes: 'Customer to confirm faucet finish before we order parts.',
      createdAt: '2026-11-10T09:00:00', sample: true, convertedTo: ''
    },
    {
      id: uid(), type: 'invoice', number: 'INV-1001', clientId: james,
      date: '2026-11-08', dueDate: '2026-11-22', status: 'sent',
      items: [
        { desc: 'Seasonal HVAC tune-up (2 units)', qty: 1, price: 149, kind: 'labor' },
        { desc: '20x25x1 air filters', qty: 4, price: 11.99, kind: 'materials' }
      ],
      discount: 0, discountType: 'percent', taxEnabled: true, taxRate: 6,
      amountPaid: 0, paidAt: '', notes: 'Next filter change due February.',
      createdAt: '2026-11-08T10:30:00', sample: true, convertedTo: ''
    }
  ];
  state.counters = { estimate: 1002, invoice: 1002 };
  state.seeded = true;
  save();
}

/* ---------------- calculations ---------------- */
function calcDoc(d) {
  const subtotal = d.items.reduce((s, it) => s + num(it.qty) * num(it.price), 0);
  const discountAmt = d.discountType === 'percent' ? subtotal * (num(d.discount) / 100) : num(d.discount);
  const taxable = Math.max(0, subtotal - discountAmt);
  const tax = d.taxEnabled ? taxable * (num(d.taxRate) / 100) : 0;
  const total = taxable + tax;
  const balance = Math.max(0, total - num(d.amountPaid));
  return { subtotal, discountAmt, taxable, tax, total, balance };
}
function getClient(id) { return state.clients.find((c) => c.id === id) || null; }
function getDoc(id) { return state.docs.find((d) => d.id === id) || null; }
function isOverdue(d) {
  if (d.type !== 'invoice') return false;
  if (d.status === 'paid') return false;
  if (d.status === 'overdue') return true;
  return d.dueDate && d.dueDate < todayISO();
}
function displayStatus(d) {
  if (d.status === 'paid') return 'paid';
  if (isOverdue(d)) return 'overdue';
  return d.status || 'draft';
}
function docsThisMonth() {
  const k = monthKey(todayISO());
  // Sample docs never consume the free quota.
  return state.docs.filter((d) => !d.sample && monthKey(d.createdAt) === k).length;
}
function canCreateDoc() { return state.pro || docsThisMonth() < FREE_DOCS_PER_MONTH; }
function sortedDocs() { return state.docs.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }

/* ---------------- navigation ---------------- */
function showView(name) {
  ui.view = name;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  $$('.view').forEach((v) => v.classList.remove('active'));
  const el = $('#view-' + name);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0 });
  renderAll();
}
function renderAll() {
  $('#brandName').textContent = state.profile.businessName || 'TradeInvoice';
  if (ui.view === 'dashboard') renderDashboard();
  if (ui.view === 'documents') renderDocs();
  if (ui.view === 'clients') renderClients();
  if (ui.view === 'settings') renderSettings();
  if (ui.view === 'doc') renderDocDetail();
}

/* ---------------- dashboard ---------------- */
function renderDashboard() {
  const invoices = state.docs.filter((d) => d.type === 'invoice');
  let outstanding = 0, outstandingCount = 0;
  invoices.forEach((d) => { const c = calcDoc(d); if (d.status !== 'paid' && c.balance > 0) { outstanding += c.balance; outstandingCount++; } });
  const overdueCount = invoices.filter(isOverdue).length;
  const k = monthKey(todayISO());
  let paidMonth = 0, paidCount = 0;
  invoices.forEach((d) => {
    if (d.paidAt && monthKey(d.paidAt) === k) { paidMonth += (d.status === 'paid' ? calcDoc(d).total : num(d.amountPaid)); paidCount++; }
  });
  const used = docsThisMonth();
  $('#statOutstanding').textContent = money(outstanding);
  $('#statOutstandingSub').textContent = outstandingCount + (outstandingCount === 1 ? ' unpaid invoice' : ' unpaid invoices');
  $('#statPaidMonth').textContent = money(paidMonth);
  $('#statPaidMonthSub').textContent = paidCount ? paidCount + (paidCount === 1 ? ' payment' : ' payments') + ' this month' : 'No payments yet this month';
  $('#statOverdue').textContent = overdueCount;
  $('#statDocsMonth').textContent = state.pro ? 'Unlimited' : used + ' / ' + FREE_DOCS_PER_MONTH;
  $('#statDocsMonthSub').textContent = state.pro ? 'Pro plan' : (used >= FREE_DOCS_PER_MONTH ? 'Limit reached — upgrade for more' : 'Free plan');
  const recent = sortedDocs().slice(0, 5);
  $('#recentDocs').innerHTML = recent.length ? recent.map(docCardHTML).join('') :
    '<div class="empty">No documents yet.<br>Tap <strong>＋ New Estimate</strong> to create your first one.</div>';
  bindDocCards($('#recentDocs'));
}

/* ---------------- documents list ---------------- */
function docCardHTML(d) {
  const c = calcDoc(d);
  const client = getClient(d.clientId);
  const st = displayStatus(d);
  const isEst = d.type === 'estimate';
  const balanceLine = isEst
    ? '<div class="doc-meta">Total ' + money(c.total) + '</div>'
    : (c.balance > 0
      ? '<div class="doc-balance">Balance due ' + money(c.balance) + '</div>'
      : '<div class="doc-balance paid">Paid in full</div>');
  const converted = d.convertedTo ? ' <span class="badge badge-converted">→ ' + esc(d.convertedTo) + '</span>' : '';
  return '<article class="doc-card" data-doc-id="' + d.id + '">' +
    '<div class="doc-top"><div>' +
      '<span class="doc-num">' + esc(d.number) + '</span> ' +
      '<span class="badge badge-' + d.type + '">' + d.type + '</span> ' +
      '<span class="badge badge-' + st + '">' + st + '</span>' + converted +
      '<div class="doc-client">' + esc(client ? client.name : 'No client') + '</div>' +
      '<div class="doc-meta">' + fmtDate(d.date) + ' · ' + d.items.length + (d.items.length === 1 ? ' item' : ' items') + '</div>' +
    '</div><div class="doc-amounts"><div class="doc-total">' + money(c.total) + '</div>' + balanceLine + '</div></div>' +
    '<div class="doc-actions">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-act="print">🖨 Print / PDF</button>' +
      (isEst && !d.convertedTo ? '<button type="button" class="btn btn-secondary btn-sm" data-act="convert">→ Convert to invoice</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="delete">Delete</button>' +
    '</div></article>';
}
function bindDocCards(root) {
  $$('.doc-card', root).forEach((card) => {
    card.addEventListener('click', (e) => {
      const id = card.dataset.docId;
      const actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        e.stopPropagation();
        const act = actBtn.dataset.act;
        if (act === 'print') printDoc(id);
        if (act === 'convert') convertEstimate(id);
        if (act === 'delete') deleteDoc(id);
        return;
      }
      openDoc(id);
    });
  });
}
function renderDocs() {
  const q = ui.docSearch.trim().toLowerCase();
  let list = sortedDocs();
  if (ui.docFilter !== 'all') {
    list = list.filter((d) => ui.docFilter === 'overdue' ? isOverdue(d) : (ui.docFilter === 'estimate' || ui.docFilter === 'invoice' ? d.type === ui.docFilter : displayStatus(d) === ui.docFilter));
  }
  if (q) {
    list = list.filter((d) => {
      const client = getClient(d.clientId);
      const hay = [d.number, client ? client.name : '', d.items.map((i) => i.desc).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  $('#docList').innerHTML = list.length ? list.map(docCardHTML).join('') :
    '<div class="empty">No documents match.<br>Create an estimate or invoice to get started.</div>';
  bindDocCards($('#docList'));
}

/* ---------------- clients ---------------- */
function renderClients() {
  const q = ui.clientSearch.trim().toLowerCase();
  let list = state.clients.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (q) list = list.filter((c) => [c.name, c.phone, c.email, c.address].join(' ').toLowerCase().includes(q));
  $('#clientList').innerHTML = list.length ? list.map((c) =>
    '<article class="client-card" data-client-id="' + c.id + '">' +
      '<div class="client-name">' + esc(c.name) + (c.sample ? ' <span class="badge badge-draft">sample</span>' : '') + '</div>' +
      '<div class="client-contact">' + [c.phone, c.email, c.address].filter(Boolean).map(esc).join('\n') + '</div>' +
      '<div class="doc-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cact="edit">Edit</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cact="new-est">＋ Estimate</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-cact="new-inv">＋ Invoice</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cact="delete">Delete</button>' +
      '</div></article>'
  ).join('') : '<div class="empty">No clients yet.<br>Tap <strong>＋ Add Client</strong> to add your first customer.</div>';
  $$('.client-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cact]');
      if (!btn) return;
      const id = card.dataset.clientId;
      const act = btn.dataset.cact;
      if (act === 'edit') openClientModal(id);
      if (act === 'delete') deleteClient(id);
      if (act === 'new-est') newDoc('estimate', id);
      if (act === 'new-inv') newDoc('invoice', id);
    });
  });
}

/* ---------------- settings ---------------- */
function renderSettings() {
  const p = state.profile;
  $('#pfBusinessName').value = p.businessName || '';
  $('#pfOwnerName').value = p.ownerName || '';
  $('#pfPhone').value = p.phone || '';
  $('#pfEmail').value = p.email || '';
  $('#pfAddress').value = p.address || '';
  $('#pfTaxRate').value = p.taxRate;
  $('#pfDueDays').value = p.dueDays;
  $('#pfTerms').value = p.paymentTerms || '';
  const prev = $('#logoPreview');
  if (p.logo) { prev.src = p.logo; prev.hidden = false; } else { prev.hidden = true; prev.removeAttribute('src'); }
  const used = docsThisMonth();
  $('#planName').textContent = state.pro ? 'Pro plan — ' + PRO_PRICE_LABEL : 'Free plan';
  $('#planUsage').textContent = state.pro
    ? 'Unlimited estimates & invoices. Thanks for supporting TradeInvoice!'
    : used + ' of ' + FREE_DOCS_PER_MONTH + ' free documents used this month.' + (used >= FREE_DOCS_PER_MONTH ? ' Limit reached — upgrade to keep creating.' : '');
  $('#planUpgradeBtn').style.display = state.pro ? 'none' : '';
}

/* ---------------- document detail & editor ---------------- */
function openDoc(id) { ui.viewingDocId = id; ui.editingDocId = null; showView('doc'); }
function newDoc(type, clientId) {
  if (!canCreateDoc()) { openProModal(); toast('Free limit reached — 3 documents per month. Go Pro for unlimited.'); return; }
  if (!state.clients.length) { toast('Add a client first — tap Clients → ＋ Add Client.'); showView('clients'); return; }
  const n = state.counters[type]++;
  const doc = {
    id: uid(), type, number: (type === 'estimate' ? 'EST-' : 'INV-') + n,
    clientId: clientId || state.clients[0].id,
    date: todayISO(),
    dueDate: addDays(todayISO(), type === 'estimate' ? 30 : num(state.profile.dueDays) || 14),
    status: 'draft',
    items: [{ desc: '', qty: 1, price: 0, kind: 'labor' }],
    discount: 0, discountType: 'percent', taxEnabled: true, taxRate: num(state.profile.taxRate),
    amountPaid: 0, paidAt: '', notes: '',
    createdAt: new Date().toISOString(), sample: false, convertedTo: ''
  };
  state.docs.push(doc);
  save();
  ui.viewingDocId = doc.id;
  ui.editingDocId = doc.id;
  showView('doc');
}
function itemRowHTML(it, idx) {
  return '<div class="item-edit-row" data-idx="' + idx + '">' +
    '<input type="text" class="ie-desc" placeholder="Description (e.g. Replace water heater)" value="' + esc(it.desc) + '" aria-label="Item description">' +
    '<input type="number" class="ie-qty" min="0" step="0.5" value="' + it.qty + '" aria-label="Quantity">' +
    '<input type="number" class="ie-price" min="0" step="0.01" value="' + it.price + '" aria-label="Unit price">' +
    '<select class="ie-kind" aria-label="Labor or materials"><option value="labor"' + (it.kind === 'labor' ? ' selected' : '') + '>Labor</option><option value="materials"' + (it.kind === 'materials' ? ' selected' : '') + '>Materials</option></select>' +
    '<button type="button" class="rm-btn" data-rm-item="' + idx + '" aria-label="Remove item">✕</button>' +
  '</div>';
}
function renderDocDetail() {
  const d = getDoc(ui.viewingDocId);
  const host = $('#docDetail');
  if (!d) { host.innerHTML = '<div class="empty">Document not found.</div><button type="button" class="btn btn-primary" id="backBtn">← Back to documents</button>'; $('#backBtn').onclick = () => showView('documents'); return; }
  if (ui.editingDocId === d.id) { renderDocEditor(d, host); return; }
  const c = calcDoc(d);
  const client = getClient(d.clientId);
  const st = displayStatus(d);
  const p = state.profile;
  host.innerHTML =
    '<button type="button" class="back-link" id="backBtn">← Back</button>' +
    '<div class="doc-detail-card">' +
      '<div class="doc-head"><div><h2>' + (d.type === 'estimate' ? 'Estimate' : 'Invoice') + ' ' + esc(d.number) + '</h2>' +
      '<div class="doc-meta">Issued ' + fmtDate(d.date) + ' · Due ' + fmtDate(d.dueDate) + '</div></div>' +
      '<span class="badge badge-' + st + '">' + st + '</span></div>' +
      (d.convertedTo ? '<p><span class="badge badge-converted">Converted to ' + esc(d.convertedTo) + '</span></p>' : '') +
      '<div class="billto"><strong>Bill to</strong><br>' + esc(client ? client.name : 'No client') + '<br>' +
        (client ? [client.address, client.phone, client.email].filter(Boolean).map(esc).join('<br>') : '') + '</div>' +
      '<table class="items-table"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>' +
      d.items.map((it) => '<tr><td>' + esc(it.desc || '(no description)') + '<span class="kind-tag">' + esc(it.kind) + '</span></td>' +
        '<td class="num">' + it.qty + '</td><td class="num">' + money(it.price) + '</td><td class="num">' + money(num(it.qty) * num(it.price)) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="totals">' +
        '<div class="totals-row"><span>Subtotal</span><span>' + money(c.subtotal) + '</span></div>' +
        (c.discountAmt > 0 ? '<div class="totals-row"><span>Discount</span><span>−' + money(c.discountAmt) + '</span></div>' : '') +
        (c.tax > 0 ? '<div class="totals-row"><span>Tax (' + num(d.taxRate) + '%)</span><span>' + money(c.tax) + '</span></div>' : '') +
        '<div class="totals-row grand"><span>Total</span><span>' + money(c.total) + '</span></div>' +
        (d.type === 'invoice' ? '<div class="totals-row"><span>Amount paid</span><span>' + money(d.amountPaid) + '</span></div>' +
          '<div class="totals-row balance' + (c.balance <= 0 ? ' zero' : '') + '"><span>Balance due</span><span>' + money(c.balance) + '</span></div>' : '') +
      '</div>' +
      (d.notes ? '<div class="terms-box"><strong>Notes</strong>\n' + esc(d.notes) + '</div>' : '') +
      '<div class="terms-box">' + esc(p.paymentTerms || '') + '</div>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn btn-primary" id="ddEdit">Edit</button>' +
        '<button type="button" class="btn btn-secondary" id="ddPrint">🖨 Print / PDF</button>' +
        (d.type === 'estimate' && !d.convertedTo ? '<button type="button" class="btn btn-accent" id="ddConvert">→ Convert to invoice</button>' : '') +
        (d.type === 'invoice' && st !== 'paid' ? '<button type="button" class="btn btn-secondary" id="ddMarkPaid">✓ Mark paid</button>' : '') +
        (st === 'draft' ? '<button type="button" class="btn btn-secondary" id="ddMarkSent">✉ Mark sent</button>' : '') +
        '<button type="button" class="btn btn-ghost" id="ddDelete">Delete</button>' +
      '</div>' +
    '</div>';
  $('#backBtn').onclick = () => showView('documents');
  $('#ddEdit').onclick = () => { ui.editingDocId = d.id; renderDocDetail(); };
  $('#ddPrint').onclick = () => printDoc(d.id);
  const cv = $('#ddConvert'); if (cv) cv.onclick = () => convertEstimate(d.id);
  const mp = $('#ddMarkPaid'); if (mp) mp.onclick = () => markPaid(d.id);
  const ms = $('#ddMarkSent'); if (ms) ms.onclick = () => { d.status = 'sent'; save(); renderDocDetail(); toast(d.number + ' marked sent.'); };
  $('#ddDelete').onclick = () => deleteDoc(d.id);
}
function renderDocEditor(d, host) {
  const clientOpts = state.clients.map((c) => '<option value="' + c.id + '"' + (c.id === d.clientId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  host.innerHTML =
    '<button type="button" class="back-link" id="backBtn">← Cancel</button>' +
    '<div class="doc-detail-card">' +
      '<h2 style="margin:0 0 12px;color:var(--navy)">' + (d.type === 'estimate' ? 'Edit estimate' : 'Edit invoice') + ' ' + esc(d.number) + '</h2>' +
      '<form id="docForm" autocomplete="off">' +
      '<label>Client <select id="dfClient">' + clientOpts + '</select></label>' +
      '<div class="form-row"><label>Date <input type="date" id="dfDate" value="' + esc(d.date) + '"></label>' +
      '<label>Due date <input type="date" id="dfDue" value="' + esc(d.dueDate) + '"></label></div>' +
      '<label>Status <select id="dfStatus">' +
        ['draft', 'sent', 'paid', 'overdue'].map((s) => '<option value="' + s + '"' + (d.status === s ? ' selected' : '') + '>' + s + '</option>').join('') +
      '</select></label>' +
      '<h3 style="margin:14px 0 6px;color:var(--navy)">Line items</h3>' +
      '<div class="item-edit-head"><span>Description</span><span>Qty</span><span>Price</span><span>Type</span><span></span></div>' +
      '<div id="dfItems">' + d.items.map(itemRowHTML).join('') + '</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="dfAddItem">＋ Add line item</button>' +
      '<div class="form-row" style="margin-top:14px"><label>Discount <input type="number" id="dfDiscount" min="0" step="0.01" value="' + d.discount + '"></label>' +
      '<label>Discount type <select id="dfDiscountType"><option value="percent"' + (d.discountType === 'percent' ? ' selected' : '') + '>% off</option><option value="fixed"' + (d.discountType === 'fixed' ? ' selected' : '') + '>$ off</option></select></label></div>' +
      '<div class="form-row"><label class="check-line"><input type="checkbox" id="dfTaxEnabled"' + (d.taxEnabled ? ' checked' : '') + '> Charge tax</label>' +
      '<label>Tax rate (%) <input type="number" id="dfTaxRate" min="0" max="30" step="0.01" value="' + d.taxRate + '"></label></div>' +
      (d.type === 'invoice' ? '<label>Amount paid ($) <input type="number" id="dfAmountPaid" min="0" step="0.01" value="' + d.amountPaid + '"></label>' : '') +
      '<label>Notes <textarea id="dfNotes" rows="2" placeholder="Anything the client should know…">' + esc(d.notes) + '</textarea></label>' +
      '<div id="dfTotals" class="totals" style="margin:10px 0"></div>' +
      '<div class="btn-row"><button type="submit" class="btn btn-primary btn-lg">Save ' + d.type + '</button>' +
      '<button type="button" class="btn btn-ghost" id="dfCancel">Cancel</button></div>' +
      '</form></div>';
  $('#backBtn').onclick = () => { ui.editingDocId = null; renderDocDetail(); };
  $('#dfCancel').onclick = () => { ui.editingDocId = null; renderDocDetail(); };
  const readItems = () => $$('#dfItems .item-edit-row').map((row) => ({
    desc: $('.ie-desc', row).value.trim(),
    qty: num($('.ie-qty', row).value) || 0,
    price: num($('.ie-price', row).value) || 0,
    kind: $('.ie-kind', row).value
  }));
  const updateTotals = () => {
    const tmp = {
      items: readItems(), discount: num($('#dfDiscount').value),
      discountType: $('#dfDiscountType').value, taxEnabled: $('#dfTaxEnabled').checked,
      taxRate: num($('#dfTaxRate').value), amountPaid: d.type === 'invoice' ? num($('#dfAmountPaid').value) : 0
    };
    const c = calcDoc(tmp);
    $('#dfTotals').innerHTML =
      '<div class="totals-row"><span>Subtotal</span><span>' + money(c.subtotal) + '</span></div>' +
      (c.discountAmt > 0 ? '<div class="totals-row"><span>Discount</span><span>−' + money(c.discountAmt) + '</span></div>' : '') +
      (c.tax > 0 ? '<div class="totals-row"><span>Tax</span><span>' + money(c.tax) + '</span></div>' : '') +
      '<div class="totals-row grand"><span>Total</span><span>' + money(c.total) + '</span></div>' +
      (d.type === 'invoice' ? '<div class="totals-row balance' + (c.balance <= 0 ? ' zero' : '') + '"><span>Balance due</span><span>' + money(c.balance) + '</span></div>' : '');
  };
  $('#dfItems').addEventListener('input', updateTotals);
  $('#dfItems').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm-item]');
    if (!rm) return;
    const rows = $$('#dfItems .item-edit-row');
    if (rows.length <= 1) { toast('An invoice needs at least one line item.'); return; }
    rm.closest('.item-edit-row').remove();
    updateTotals();
  });
  $('#dfAddItem').onclick = () => {
    $('#dfItems').insertAdjacentHTML('beforeend', itemRowHTML({ desc: '', qty: 1, price: 0, kind: 'labor' }, Date.now()));
    updateTotals();
  };
  ['dfDiscount', 'dfDiscountType', 'dfTaxEnabled', 'dfTaxRate', 'dfAmountPaid'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateTotals);
  });
  updateTotals();
  $('#docForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const items = readItems().filter((it) => it.desc !== '' || it.price > 0);
    if (!items.length) { toast('Add at least one line item with a description.'); return; }
    d.clientId = $('#dfClient').value;
    d.date = $('#dfDate').value || todayISO();
    d.dueDate = $('#dfDue').value || d.date;
    d.status = $('#dfStatus').value;
    d.items = items;
    d.discount = num($('#dfDiscount').value);
    d.discountType = $('#dfDiscountType').value;
    d.taxEnabled = $('#dfTaxEnabled').checked;
    d.taxRate = num($('#dfTaxRate').value);
    d.notes = $('#dfNotes').value.trim();
    if (d.type === 'invoice') {
      d.amountPaid = num($('#dfAmountPaid').value);
      const c = calcDoc(d);
      if (c.total > 0 && c.balance <= 0) { d.status = 'paid'; d.paidAt = d.paidAt || todayISO(); }
      else if (num(d.amountPaid) > 0) { d.paidAt = d.paidAt || todayISO(); }
      if (d.status !== 'paid') d.paidAt = num(d.amountPaid) > 0 ? (d.paidAt || todayISO()) : '';
    }
    save();
    ui.editingDocId = null;
    renderDocDetail();
    toast(d.number + ' saved.');
  });
}

/* ---------------- doc actions ---------------- */
function deleteDoc(id) {
  const d = getDoc(id); if (!d) return;
  askConfirm('Delete ' + d.number + '?', 'This removes the ' + d.type + ' permanently. This cannot be undone.', () => {
    state.docs = state.docs.filter((x) => x.id !== id);
    save();
    if (ui.viewingDocId === id) { ui.viewingDocId = null; showView('documents'); } else renderAll();
    toast(d.number + ' deleted.');
  });
}
function convertEstimate(id) {
  const e = getDoc(id); if (!e || e.type !== 'estimate') return;
  if (!canCreateDoc()) { openProModal(); toast('Free limit reached — 3 documents per month. Go Pro for unlimited.'); return; }
  const n = state.counters.invoice++;
  const inv = {
    id: uid(), type: 'invoice', number: 'INV-' + n, clientId: e.clientId,
    date: todayISO(), dueDate: addDays(todayISO(), num(state.profile.dueDays) || 14),
    status: 'draft', items: e.items.map((it) => ({ ...it })),
    discount: e.discount, discountType: e.discountType, taxEnabled: e.taxEnabled, taxRate: e.taxRate,
    amountPaid: 0, paidAt: '', notes: e.notes,
    createdAt: new Date().toISOString(), sample: false, convertedTo: '', fromEstimate: e.number
  };
  state.docs.push(inv);
  e.convertedTo = inv.number;
  save();
  ui.viewingDocId = inv.id;
  showView('doc');
  toast(e.number + ' converted to ' + inv.number + '.');
}
function markPaid(id) {
  const d = getDoc(id); if (!d) return;
  const c = calcDoc(d);
  d.amountPaid = c.total;
  d.status = 'paid';
  d.paidAt = todayISO();
  save();
  renderDocDetail();
  toast(d.number + ' marked paid — ' + money(c.total) + '.');
}

/* ---------------- print / PDF ---------------- */
function printDoc(id) {
  const d = getDoc(id); if (!d) return;
  const c = calcDoc(d);
  const client = getClient(d.clientId);
  const p = state.profile;
  const logo = p.logo ? '<img class="print-logo" src="' + p.logo + '" alt="logo">' : '';
  $('#print-area').innerHTML =
    '<div class="print-doc">' +
    '<header><div><h1>' + esc(p.businessName || 'TradeInvoice') + '</h1>' +
      '<div class="p-muted">' + [p.ownerName, p.address, p.phone, p.email].filter(Boolean).map(esc).join('\n') + '</div></div>' +
      '<div>' + logo + '<h2 style="text-align:right">' + (d.type === 'estimate' ? 'ESTIMATE' : 'INVOICE') + '</h2>' +
      '<div class="p-muted" style="text-align:right">' + esc(d.number) + '<br>Issued: ' + fmtDate(d.date) + '<br>Due: ' + fmtDate(d.dueDate) + '</div></div></header>' +
    '<div><strong>Bill to:</strong><br>' + esc(client ? client.name : '—') + '<br>' +
      '<span class="p-muted">' + (client ? [client.address, client.phone, client.email].filter(Boolean).map(esc).join('<br>') : '') + '</span></div>' +
    '<table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>' +
    d.items.map((it) => '<tr><td>' + esc(it.desc) + ' <span style="color:#666;font-size:9pt">(' + esc(it.kind) + ')</span></td><td class="num">' + it.qty + '</td><td class="num">' + money(it.price) + '</td><td class="num">' + money(num(it.qty) * num(it.price)) + '</td></tr>').join('') +
    '</tbody></table>' +
    '<div class="print-totals">' +
      '<div><span>Subtotal</span><span>' + money(c.subtotal) + '</span></div>' +
      (c.discountAmt > 0 ? '<div><span>Discount</span><span>−' + money(c.discountAmt) + '</span></div>' : '') +
      (c.tax > 0 ? '<div><span>Tax (' + num(d.taxRate) + '%)</span><span>' + money(c.tax) + '</span></div>' : '') +
      '<div class="grand"><span>Total</span><span>' + money(c.total) + '</span></div>' +
      (d.type === 'invoice' ? '<div><span>Amount paid</span><span>' + money(d.amountPaid) + '</span></div><div class="grand"><span>Balance due</span><span>' + money(c.balance) + '</span></div>' : '') +
    '</div>' +
    (d.notes ? '<div class="print-terms"><strong>Notes</strong>\n' + esc(d.notes) + '</div>' : '') +
    '<div class="print-terms">' + esc(p.paymentTerms || '') + '\n\nThank you for your business!</div>' +
    '</div>';
  window.print();
}

/* ---------------- clients ---------------- */
function openClientModal(id) {
  const c = id ? getClient(id) : null;
  $('#clientModalTitle').textContent = c ? 'Edit client' : 'Add client';
  $('#cfId').value = c ? c.id : '';
  $('#cfName').value = c ? c.name : '';
  $('#cfPhone').value = c ? c.phone : '';
  $('#cfEmail').value = c ? c.email : '';
  $('#cfAddress').value = c ? c.address : '';
  $('#clientModal').hidden = false;
  setTimeout(() => $('#cfName').focus(), 50);
}
function deleteClient(id) {
  const c = getClient(id); if (!c) return;
  const used = state.docs.filter((d) => d.clientId === id).length;
  askConfirm('Delete ' + c.name + '?', used ? 'This client has ' + used + ' document(s). The documents will stay but lose their client link.' : 'This removes the client permanently.', () => {
    state.clients = state.clients.filter((x) => x.id !== id);
    state.docs.forEach((d) => { if (d.clientId === id) d.clientId = ''; });
    save(); renderAll();
    toast(c.name + ' deleted.');
  });
}

/* ---------------- pro / upgrade ---------------- */
function openProModal() {
  const used = docsThisMonth();
  $('#proUsageText').textContent = state.pro ? 'Pro active — unlimited documents' : used + ' of ' + FREE_DOCS_PER_MONTH + ' documents';
  $('#proModal').hidden = false;
}
function onUpgradeClick() {
  if (!STRIPE_CHECKOUT_URL) {
    toast('Checkout is not connected yet — the owner needs to add the Stripe link in app.js (STRIPE_CHECKOUT_URL).');
    return;
  }
  window.open(STRIPE_CHECKOUT_URL, '_blank');
}

/* ---------------- data: export / import / reset ---------------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'trade-invoice-backup-' + todayISO() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded.');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.docs) || !Array.isArray(parsed.clients)) throw new Error('bad file');
      askConfirm('Import this backup?', 'This replaces ALL current data — clients, documents, and settings — with the backup file.', () => {
        const fresh = defaultState();
        state = Object.assign(fresh, parsed);
        state.profile = Object.assign(fresh.profile, parsed.profile || {});
        state.counters = Object.assign(fresh.counters, parsed.counters || {});
        save(); renderAll();
        toast('Backup imported — ' + state.docs.length + ' documents, ' + state.clients.length + ' clients.');
      });
    } catch (e) { toast('That file is not a valid TradeInvoice backup.'); }
  };
  reader.readAsText(file);
}
function clearSampleData() {
  const nDocs = state.docs.filter((d) => d.sample).length;
  const nClients = state.clients.filter((c) => c.sample).length;
  if (!nDocs && !nClients) { toast('No sample data to clear.'); return; }
  askConfirm('Clear sample data?', 'Removes ' + nDocs + ' sample document(s) and ' + nClients + ' sample client(s). Your own data stays.', () => {
    state.docs = state.docs.filter((d) => !d.sample);
    state.clients = state.clients.filter((c) => !c.sample);
    save(); renderAll();
    toast('Sample data cleared.');
  });
}

/* ---------------- modal helpers / toast ---------------- */
function askConfirm(title, text, onYes) {
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = text;
  confirmCallback = onYes;
  $('#confirmModal').hidden = false;
}
function closeModals() { $$('.modal').forEach((m) => { m.hidden = true; }); }
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* ---------------- logo upload ---------------- */
function handleLogoFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 240;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      state.profile.logo = canvas.toDataURL('image/jpeg', 0.85);
      save(); renderSettings();
      toast('Logo saved.');
    };
    img.onerror = () => toast('That image could not be read. Try a JPG or PNG.');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---------------- init & wiring ---------------- */
function init() {
  state = load();
  if (!state) seed();
  if (!state.counters) state.counters = { estimate: 1001, invoice: 1001 };
  if (typeof state.pro !== 'boolean') state.pro = false;

  $$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('#qaNewEstimate').onclick = () => newDoc('estimate');
  $('#qaNewInvoice').onclick = () => newDoc('invoice');
  $('#docsNewEstimate').onclick = () => newDoc('estimate');
  $('#docsNewInvoice').onclick = () => newDoc('invoice');
  $('#docSearch').addEventListener('input', (e) => { ui.docSearch = e.target.value; renderDocs(); });
  $('#clientSearch').addEventListener('input', (e) => { ui.clientSearch = e.target.value; renderClients(); });
  $$('#docFilters .chip').forEach((chip) => chip.addEventListener('click', () => {
    $$('#docFilters .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    ui.docFilter = chip.dataset.filter;
    renderDocs();
  }));
  $('#addClientBtn').onclick = () => openClientModal(null);
  $('#clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#cfName').value.trim();
    if (!name) { toast('Client name is required.'); return; }
    const id = $('#cfId').value;
    const data = { name, phone: $('#cfPhone').value.trim(), email: $('#cfEmail').value.trim(), address: $('#cfAddress').value.trim() };
    if (id) { const c = getClient(id); if (c) Object.assign(c, data); }
    else state.clients.push(Object.assign({ id: uid(), sample: false }, data));
    save(); closeModals(); renderAll();
    toast('Client saved.');
  });
  $('#profileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.profile.businessName = $('#pfBusinessName').value.trim();
    state.profile.ownerName = $('#pfOwnerName').value.trim();
    state.profile.phone = $('#pfPhone').value.trim();
    state.profile.email = $('#pfEmail').value.trim();
    state.profile.address = $('#pfAddress').value.trim();
    state.profile.taxRate = num($('#pfTaxRate').value);
    state.profile.dueDays = Math.max(0, Math.round(num($('#pfDueDays').value)));
    state.profile.paymentTerms = $('#pfTerms').value.trim();
    save(); renderAll();
    toast('Business profile saved.');
  });
  $('#logoUploadBtn').onclick = () => $('#pfLogo').click();
  $('#pfLogo').addEventListener('change', (e) => { handleLogoFile(e.target.files[0]); e.target.value = ''; });
  $('#logoRemoveBtn').onclick = () => { state.profile.logo = ''; save(); renderSettings(); toast('Logo removed.'); };
  $('#proBtn').onclick = openProModal;
  $('#planUpgradeBtn').onclick = openProModal;
  $('#proCheckoutBtn').onclick = onUpgradeClick;
  $('#exportBtn').onclick = exportData;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
  $('#clearSampleBtn').onclick = clearSampleData;
  $('#resetAllBtn').onclick = () => askConfirm('Reset everything?', 'Deletes ALL clients, documents, and settings on this device. Export a backup first if you want to keep anything.', () => {
    localStorage.removeItem(LS_KEY);
    location.reload();
  });
  $('#confirmYes').onclick = () => { closeModals(); if (confirmCallback) { const cb = confirmCallback; confirmCallback = null; cb(); } };
  $$('[data-close-modal]').forEach((b) => b.addEventListener('click', closeModals));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
  window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });

  renderAll();
}
document.addEventListener('DOMContentLoaded', init);
