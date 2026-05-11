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

    // Încarcă date extinse (administratori, detalii ONRC) async
    loadExtendedData(cui);

  } catch (err) {
    let msg = err.message || 'Eroare la încărcarea datelor.';
    // Detectează eroarea de protocol file://
    if (msg.includes('Failed to fetch') || msg.includes('fetch') || msg.includes('NetworkError')) {
      if (window.location.protocol === 'file:') {
        msg = 'Deschide site-ul dintr-un server HTTP (nu direct din fișier). Folosește Live Server în VS Code sau accesează versiunea online.';
      } else {
        msg = 'Eroare de conexiune. Verifică internetul și încearcă din nou.';
      }
    }
    showError(msg);
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

async function addToWatchlist() {
  if (!Auth.isAuthenticated()) {
    if (confirm('Trebuie să fii autentificat pentru a adăuga firme la favorite. Mergi la pagina de login?')) {
      window.location.href = 'login.html';
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/favorites`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ 
        cui: currentCUI, 
        denumire: dateGenerale?.denumire || '' 
      })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Eroare la adăugare.');
    
    alert('✅ Firmă adăugată la favorite cu succes!');
  } catch (err) {
    alert(err.message);
  }
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

// ── EXTENDED DATA (FirmeAPI.ro) ───────────────────────────
async function loadExtendedData(cui) {
  // Load both in parallel
  const [detalii, adminData] = await Promise.all([
    FirmeAPI.getDetalii(cui).catch(() => null),
    FirmeAPI.getAdministratori(cui).catch(() => null)
  ]);

  // Enrich general tab with ONRC details
  if (detalii) {
    renderDetaliiONRC(detalii);
  }

  // Render administrators
  renderAdministratori(adminData);
}

function renderDetaliiONRC(d) {
  const grid = document.getElementById('fiscalGrid');
  if (!grid) return;

  // Add extra ONRC fields
  const extraItems = [];
  if (d.nr_reg_com) extraItems.push({ label: 'Nr. Registrul Comerțului', value: d.nr_reg_com });
  if (d.cod_caen) extraItems.push({ label: 'Cod CAEN Principal', value: d.cod_caen });
  if (d.organ_fiscal) extraItems.push({ label: 'Organ Fiscal Competent', value: d.organ_fiscal });
  if (d.forma_organizare) extraItems.push({ label: 'Formă Organizare', value: d.forma_organizare });
  if (d.stare) extraItems.push({ label: 'Stare Înregistrare (ONRC)', value: d.stare });
  if (d.tva && typeof d.tva.platitor !== 'undefined') {
    extraItems.push({ label: 'Plătitor TVA (ONRC)', value: d.tva.platitor ? '✅ Da' : '❌ Nu' });
  }
  if (d.adresa_sediu_social) {
    const a = d.adresa_sediu_social;
    const adresaStr = [a.strada, a.numar ? `Nr. ${a.numar}` : '', a.localitate, a.judet].filter(Boolean).join(', ');
    if (adresaStr) extraItems.push({ label: 'Sediu Social (ONRC)', value: adresaStr });
  }

  if (extraItems.length > 0) {
    grid.innerHTML += extraItems.map(i => `
      <div class="info-item">
        <div class="info-label">${i.label}</div>
        <div class="info-value">${i.value}</div>
      </div>`).join('');
  }
}

function renderAdministratori(data) {
  const container = document.getElementById('adminInfo');
  if (!container) return;

  if (!data || !data.administratori || data.administratori.length === 0) {
    container.innerHTML = `
      <p style="color:var(--text-muted);font-size:.9rem">
        Datele despre administratori nu sunt disponibile momentan.<br>
        Verifică la <a href="https://www.onrc.ro/index.php/ro/servicii-online" target="_blank">portalul ONRC</a>.
      </p>`;
    return;
  }

  const admins = data.administratori;
  const activi = admins.filter(a => a.stare === 'Activ');
  const inactivi = admins.filter(a => a.stare !== 'Activ');

  let html = '';

  // Summary bar
  html += `<div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">`;
  html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(16,185,129,.1);border-radius:20px;font-size:.85rem;color:#10b981;font-weight:600">● ${activi.length} Activ${activi.length !== 1 ? 'i' : ''}</div>`;
  if (inactivi.length > 0) {
    html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(239,68,68,.1);border-radius:20px;font-size:.85rem;color:#ef4444;font-weight:600">● ${inactivi.length} Inactiv${inactivi.length !== 1 ? 'i' : ''}</div>`;
  }
  if (data.nr_reg_com) {
    html += `<div style="display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(99,102,241,.1);border-radius:20px;font-size:.85rem;color:#6366f1;font-weight:600">📋 ${data.nr_reg_com}</div>`;
  }
  html += `</div>`;

  // Admin cards
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">`;
  admins.forEach(admin => {
    const isActiv = admin.stare === 'Activ';
    const borderColor = isActiv ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.15)';
    const dotColor = isActiv ? '#10b981' : '#ef4444';
    const bgColor = isActiv ? 'rgba(16,185,129,.04)' : 'rgba(239,68,68,.04)';
    const tipIcon = admin.tip === 'Persoană Fizică' ? '👤' : '🏢';

    html += `
      <div style="border:1px solid ${borderColor};border-radius:12px;padding:16px;background:${bgColor};transition:transform .2s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='none'">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="font-size:1.5rem">${tipIcon}</div>
          <div style="flex:1">
            <div style="font-weight:600;color:var(--text-primary);font-size:.95rem">${admin.nume}</div>
            <div style="font-size:.8rem;color:var(--text-muted)">${admin.tip || 'Persoană Fizică'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;font-size:.75rem;font-weight:600;color:${dotColor}">
            <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block"></span>
            ${admin.stare || '—'}
          </div>
        </div>
        ${admin.data ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">📅 Actualizat: ${admin.data}</div>` : ''}
      </div>`;
  });
  html += `</div>`;

  if (data.actualizat_la) {
    html += `<div style="font-size:.75rem;color:var(--text-muted);margin-top:14px;text-align:right">Sursa: ONRC via FirmeAPI.ro · Actualizat: ${new Date(data.actualizat_la).toLocaleDateString('ro-RO')}</div>`;
  }

  container.innerHTML = html;
}

// Nav search
document.getElementById('navSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim().replace(/\D/g,'');
    if (val.length >= 4) window.location.href = `firma.html?cui=${val}`;
  }
});
