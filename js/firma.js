/**
 * firma.js — Logica completă a paginii profil firmă
 */

let currentCUI = null;
let bilantData = [];
let dateGenerale = null;
let riskData = null;

// ── INIT ──────────────────────────────────────────────────
(async function init() {
  const params = new URLSearchParams(location.search);
  const cui = params.get('cui');
  if (!cui || !/^\d{4,10}$/.test(cui.trim())) {
    showError('CUI lipsă sau invalid. Te rugăm să introduci un CUI valid.');
    return;
  }
  currentCUI = cui.trim();
  await loadFirma(currentCUI);
})();

async function loadFirma(cui) {
  showLoading();
  try {
    dateGenerale = await FirmeAPI.getDateGenerale(cui);
    renderHeader(dateGenerale);
    renderGeneralTab(dateGenerale);
    showContent();

    // Salvăm în recent
    saveRecentSearch(cui, dateGenerale.denumire);

    // Încarcă bilanțuri async
    loadBilant(cui);

  } catch (err) {
    showError(err.message || 'Eroare la încărcarea datelor.');
  }
}

async function loadBilant(cui) {
  try {
    bilantData = await FirmeAPI.getBilant(cui);
    if (bilantData.length === 0) {
      document.getElementById('bilantBody').innerHTML =
        `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">Nu s-au găsit bilanțuri disponibile pentru acest CUI.</td></tr>`;
      return;
    }
    riskData = FirmeAPI.calcRiskScore(bilantData);
    renderFinanciarTab(bilantData);
    renderBilantTable(bilantData);
    renderRiscTab(riskData, bilantData);
    renderRiskRing(riskData);
  } catch (err) {
    console.warn('Bilanțuri indisponibile:', err.message);
    document.getElementById('bilantBody').innerHTML =
      `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">Bilanțurile nu sunt disponibile momentan.</td></tr>`;
  }
}

// ── HEADER ──────────────────────────────────────────────
function renderHeader(d) {
  document.title = `${d.denumire} — FirmeRO`;
  document.getElementById('pageTitle').textContent = `${d.denumire} — FirmeRO`;

  document.getElementById('firmaDenumire').textContent = d.denumire || '—';

  const activ = d.statusInactivi === 0;
  const statutEl = document.getElementById('firmaStatut');
  statutEl.textContent = activ ? '● Activă' : '● Inactivă';
  statutEl.className = `badge ${activ ? 'badge-green' : 'badge-red'}`;

  if (d.scpTva === 'DA') {
    document.getElementById('firmaTVA').style.display = 'inline-flex';
  }

  const meta = [];
  if (d.cui) meta.push(`<span>🔢 CUI ${d.cui}</span>`);
  if (d.adresa) meta.push(`<span>📍 ${d.adresa}</span>`);
  if (d.judet) meta.push(`<span>🗺️ ${d.judet}</span>`);
  if (d.dataInfiintare) meta.push(`<span>📅 Înfințată: ${d.dataInfiintare}</span>`);
  document.getElementById('firmaMeta').innerHTML = meta.join('');

  const onrcLink = document.getElementById('onrcLink');
  onrcLink.href = `https://portal.onrc.ro/ONRCPortalWeb/appmanager/portal/!ut/p/a1/?cui=${d.cui}`;

  document.getElementById('adresaCompleta').textContent = d.adresa || '—';
  const gmLink = document.getElementById('googleMapsLink');
  if (d.adresa) gmLink.href = `https://www.google.com/maps/search/${encodeURIComponent(d.adresa + ', Romania')}`;

  initLeafletMap(d);
}

function initLeafletMap(d) {
  if (!d.adresa) return;
  try {
    const mapEl = document.getElementById('firmaMap');
    mapEl.innerHTML = '';
    const map = L.map('firmaMap', { zoomControl: true }).setView([45.75, 24.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Geocodare cu Nominatim
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(d.adresa+', Romania')}&limit=1`)
      .then(r => r.json())
      .then(results => {
        if (results && results[0]) {
          const { lat, lon } = results[0];
          map.setView([lat, lon], 15);
          L.marker([lat, lon]).addTo(map)
            .bindPopup(`<b>${d.denumire}</b><br>${d.adresa}`).openPopup();
        }
      }).catch(() => {});
  } catch {}
}

// ── GENERAL TAB ──────────────────────────────────────────
function renderGeneralTab(d) {
  const grid = document.getElementById('infoGrid');
  const items = [
    { label: 'CUI / CIF', value: d.cui || '—' },
    { label: 'Denumire', value: d.denumire || '—' },
    { label: 'Județ', value: d.judet || '—' },
    { label: 'Localitate', value: d.localitate || '—' },
    { label: 'Adresă sediu', value: d.adresa || '—' },
    { label: 'Cod Poștal', value: d.codPostal || '—' },
    { label: 'Stare', value: d.statusInactivi === 0 ? '✅ Activă' : '❌ Inactivă' },
    { label: 'Plătitor TVA', value: d.scpTva === 'DA' ? '✅ Da' : '❌ Nu' },
    { label: 'TVA la Încasare', value: d.tvaIncasare ? '✅ Da' : '❌ Nu' },
    { label: 'Tip Contribuabil', value: d.tipAct || '—' },
  ];
  grid.innerHTML = items.map(i => `
    <div class="info-item">
      <div class="info-label">${i.label}</div>
      <div class="info-value">${i.value}</div>
    </div>`).join('');

  const fiscal = document.getElementById('fiscalGrid');
  const fiscalItems = [
    { label: 'Data înregistrare fiscală', value: d.dataInregistrare || '—' },
    { label: 'Înregistrat în scopuri TVA', value: d.dataInceputTva || '—' },
    { label: 'Sfârșit TVA', value: d.dataSfarsitTva || 'Activ' },
    { label: 'Organ fiscal', value: d.organFiscal || '—' },
  ];
  fiscal.innerHTML = fiscalItems.map(i => `
    <div class="info-item">
      <div class="info-label">${i.label}</div>
      <div class="info-value">${i.value}</div>
    </div>`).join('');
}

// ── FINANCIAR TAB ──────────────────────────────────────────
function renderFinanciarTab(data) {
  if (!data || data.length === 0) return;
  const latest = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;

  function trend(curr, prev) {
    if (!prev || prev === 0) return '';
    const pct = ((curr - prev) / Math.abs(prev) * 100).toFixed(1);
    const cls = curr >= prev ? 'up' : 'down';
    const icon = curr >= prev ? '▲' : '▼';
    return `<div class="kpi-trend ${cls}">${icon} ${Math.abs(pct)}% față de ${data[data.length-2].an}</div>`;
  }

  const kpis = [
    { label: 'Cifră Afaceri', value: FirmeAPI.formatCurrency(latest.cifraAfaceri), trend: trend(latest.cifraAfaceri, prev?.cifraAfaceri), cls: '' },
    { label: 'Profit Net', value: FirmeAPI.formatCurrency(latest.profitNet), trend: trend(latest.profitNet, prev?.profitNet), cls: latest.profitNet >= 0 ? 'positive' : 'negative' },
    { label: 'Total Active', value: FirmeAPI.formatCurrency(latest.totalActive), trend: '', cls: '' },
    { label: 'Angajați', value: FirmeAPI.formatNumber(latest.nrAngajati), trend: trend(latest.nrAngajati, prev?.nrAngajati), cls: '' },
    { label: 'Capital Propriu', value: FirmeAPI.formatCurrency(latest.capitalPropriu), trend: '', cls: latest.capitalPropriu >= 0 ? 'positive' : 'negative' },
    { label: 'Datorii Totale', value: FirmeAPI.formatCurrency(latest.datoriiTotale), trend: '', cls: '' },
  ];

  document.getElementById('finKPIGrid').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label} (${latest.an})</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
      ${k.trend}
    </div>`).join('');

  // Indicatori
  const ratioLichiditate = latest.datoriiCurente > 0 ? (latest.activeCirculante / latest.datoriiCurente).toFixed(2) : '—';
  const ratioIndatorare = latest.totalActive > 0 ? ((latest.datoriiTotale / latest.totalActive) * 100).toFixed(1) + '%' : '—';
  const marjaProfit = latest.cifraAfaceri > 0 ? ((latest.profitNet / latest.cifraAfaceri) * 100).toFixed(1) + '%' : '—';
  const rentActivActive = latest.totalActive > 0 ? ((latest.profitNet / latest.totalActive) * 100).toFixed(1) + '%' : '—';
  const rentCapProp = latest.capitalPropriu > 0 ? ((latest.profitNet / latest.capitalPropriu) * 100).toFixed(1) + '%' : '—';

  document.getElementById('indicatoriGrid').innerHTML = [
    { label: 'Lichiditate Curentă', value: ratioLichiditate, note: '> 1 = bun' },
    { label: 'Rata Îndatorare', value: ratioIndatorare, note: '< 50% = bun' },
    { label: 'Marjă Profit Net', value: marjaProfit, note: 'CA vs Profit' },
    { label: 'Rentabilitate Active (ROA)', value: rentActivActive, note: '' },
    { label: 'Rentabilitate Cap. Propriu (ROE)', value: rentCapProp, note: '' },
  ].map(i => `
    <div class="info-item">
      <div class="info-label">${i.label}</div>
      <div class="info-value">${i.value}</div>
      ${i.note ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">${i.note}</div>` : ''}
    </div>`).join('');

  // Render charts
  setTimeout(() => {
    renderCAChart('chartCA', data);
    renderAngajatiChart('chartAngajati', data);
    renderStructuraChart('chartStructura', data);
    renderEvolutieChart('chartEvolutie', data);
  }, 100);
}

// ── BILANT TABLE ──────────────────────────────────────────
function renderBilantTable(data) {
  const tbody = document.getElementById('bilantBody');
  tbody.innerHTML = [...data].reverse().map(b => {
    const marja = b.cifraAfaceri > 0 ? ((b.profitNet / b.cifraAfaceri) * 100).toFixed(1) + '%' : '—';
    const profitCls = b.profitNet >= 0 ? 'color:var(--green)' : 'color:var(--red)';
    return `<tr>
      <td><strong>${b.an}</strong></td>
      <td>${FirmeAPI.formatCurrency(b.cifraAfaceri)}</td>
      <td style="${profitCls}">${FirmeAPI.formatCurrency(b.profitNet)}</td>
      <td>${FirmeAPI.formatCurrency(b.totalActive)}</td>
      <td>${FirmeAPI.formatCurrency(b.capitalPropriu)}</td>
      <td>${FirmeAPI.formatCurrency(b.datoriiTotale)}</td>
      <td>${FirmeAPI.formatNumber(b.nrAngajati)}</td>
      <td style="${profitCls}">${marja}</td>
    </tr>`;
  }).join('');
}

// ── RISC TAB ──────────────────────────────────────────────
function renderRiscTab(risk, data) {
  if (!risk) return;
  const colors = { low: '#10b981', med: '#f59e0b', high: '#ef4444' };
  const color = colors[risk.level] || '#6366f1';

  const big = document.getElementById('bigRiskRing');
  big.className = `risk-ring-wrap risk-${risk.level}`;
  document.getElementById('bigRiskNum').textContent = risk.score;
  document.getElementById('bigRiskLabel').textContent = risk.label;
  document.getElementById('bigRiskLabel').style.color = color;
  document.getElementById('zScoreVal').textContent = `Altman Z-Score: ${risk.z}`;

  // Animate big ring (r=68, circ≈427.3)
  const circ = 427.3;
  const offset = circ - (risk.score / 100) * circ;
  const circle = document.getElementById('bigRiskCircle');
  circle.style.stroke = color;
  setTimeout(() => { circle.style.strokeDashoffset = offset; }, 300);

  if (!data || data.length === 0) return;
  const latest = data[data.length - 1];

  const factors = [
    { name: 'Lichiditate (Capital Circulant)', val: latest.totalActive > 0 ? (latest.activeCirculante - latest.datoriiCurente) / latest.totalActive : 0, max: 1 },
    { name: 'Rentabilitate Active', val: latest.totalActive > 0 ? latest.profitNet / latest.totalActive : 0, max: 0.3 },
    { name: 'Capitalizare vs Datorii', val: latest.datoriiTotale > 0 ? latest.capitalPropriu / latest.datoriiTotale : 1, max: 2 },
    { name: 'Eficiență Active (CA/Active)', val: latest.totalActive > 0 ? latest.cifraAfaceri / latest.totalActive : 0, max: 2 },
    { name: 'Structură Financiară', val: latest.capitalPropriu > 0 ? 1 : 0, max: 1 },
  ];

  document.getElementById('riskFactors').innerHTML = factors.map(f => {
    const pct = Math.min(100, Math.max(0, (f.val / f.max) * 100));
    const fcolor = pct > 60 ? '#10b981' : pct > 30 ? '#f59e0b' : '#ef4444';
    return `<div class="risk-factor">
      <div class="risk-factor-name">${f.name}</div>
      <div class="risk-factor-bar"><div class="risk-factor-fill" style="width:${pct}%;background:${fcolor}"></div></div>
      <div class="risk-factor-val" style="color:${fcolor}">${f.val.toFixed(2)}</div>
    </div>`;
  }).join('');
}

function renderRiskRing(risk) {
  if (!risk) return;
  const container = document.getElementById('riskContainer');
  container.style.display = 'block';
  const colors = { low: '#10b981', med: '#f59e0b', high: '#ef4444' };
  const color = colors[risk.level] || '#6366f1';
  document.getElementById('riskNum').textContent = risk.score;
  document.getElementById('riskLabel').textContent = risk.label;
  document.getElementById('riskLabel').style.color = color;
  const ring = document.getElementById('riskRing');
  ring.className = `risk-ring-wrap risk-${risk.level}`;
  const circ = 326.7;
  const offset = circ - (risk.score / 100) * circ;
  const circle = document.getElementById('riskCircle');
  circle.style.stroke = color;
  setTimeout(() => { circle.style.strokeDashoffset = offset; }, 600);
}

// ── TABS ──────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    const tabs = ['general','financiar','bilant','risc','locatie'];
    b.classList.toggle('active', tabs[i] === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabId}`);
  });
}

// ── EXPORT CSV ────────────────────────────────────────────
function exportCSV() {
  if (!bilantData.length) return;
  const headers = ['An','Cifra Afaceri','Profit Net','Total Active','Capital Propriu','Datorii','Angajati'];
  const rows = bilantData.map(b => [b.an, b.cifraAfaceri, b.profitNet, b.totalActive, b.capitalPropriu, b.datoriiTotale, b.nrAngajati]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bilant_${currentCUI}.csv`;
  a.click();
}

function exportPDF() { window.print(); }

function addToWatchlist() {
  try {
    let list = JSON.parse(localStorage.getItem('firme_watchlist') || '[]');
    if (!list.find(f => f.cui === currentCUI)) {
      list.push({ cui: currentCUI, denumire: dateGenerale?.denumire, addedAt: Date.now() });
      localStorage.setItem('firme_watchlist', JSON.stringify(list));
      alert('✅ Firmă adăugată la lista de monitorizare!');
    } else {
      alert('Firma este deja monitorizată.');
    }
  } catch {}
}

function addToCompare() {
  try {
    let list = JSON.parse(localStorage.getItem('firme_compare') || '[]');
    if (!list.includes(currentCUI)) {
      list.push(currentCUI);
      localStorage.setItem('firme_compare', JSON.stringify(list));
    }
    window.location.href = `comparare.html?cui=${currentCUI}`;
  } catch {}
}

// ── UI HELPERS ────────────────────────────────────────────
function showLoading() {
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('firmaContent').style.display = 'none';
}
function showContent() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('firmaContent').style.display = 'block';
}
function showError(msg) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('firmaContent').style.display = 'none';
  document.getElementById('errorMsg').textContent = msg;
}

// Nav search
document.getElementById('navSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim().replace(/\D/g,'');
    if (val.length >= 4) window.location.href = `firma.html?cui=${val}`;
  }
});
