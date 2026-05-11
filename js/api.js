/**
 * api.js — ANAF API wrapper pentru FirmeRO
 * Suportă două moduri:
 *  1. DIRECT: fetch direct la ANAF din browser (CORS permis)
 *  2. BACKEND: via Railway backend (activat dacă RAILWAY_URL e setat)
 *     → activează căutarea după denumire
 */

// Setează URL-ul backend-ului Railway după deploy
// Exemplu: const RAILWAY_URL = 'https://firme-ro-api.up.railway.app';
const RAILWAY_URL = window.FIRME_API_URL || null;

const ANAF_BASE = 'https://webservicesp.anaf.ro';

// Cache simplu localStorage
const cache = {
  get(key) { try { const d = localStorage.getItem('firme_'+key); return d ? JSON.parse(d) : null; } catch { return null; } },
  set(key, val, ttl=3600000) { try { localStorage.setItem('firme_'+key, JSON.stringify({val, exp: Date.now()+ttl})); } catch {} },
  read(key) { const d = this.get(key); return (d && d.exp > Date.now()) ? d.val : null; }
};

/**
 * Obţine date generale despre o firmă după CUI
 * Strategie:
 *  1. Railway proxy (dacă configurat) → dacă returnează fallback:true →
 *  2. Direct ANAF din browser (funcționează din HTTP, nu file://)
 */
async function getDateGenerale(cui) {
  cui = String(cui).replace(/\D/g, '');
  const cacheKey = `gen_${cui}`;
  const cached = cache.read(cacheKey);
  if (cached) return cached;

  let data = null;
  if (RAILWAY_URL) {
    try {
      const res = await fetch(`${RAILWAY_URL}/api/firma/${cui}`, {
        signal: AbortSignal.timeout(12000)
      });
      const json = await res.json();
      if (res.ok && json.data) {
        data = json.data;
      } else {
        throw new Error(json.error || 'Firma nu a putut fi găsită sau serviciul ANAF este indisponibil.');
      }
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Timpul de așteptare a expirat. Încearcă din nou.');
      throw new Error(e.message || 'Eroare de conexiune la serverul proxy.');
    }
  } else {
    throw new Error('API-ul backend nu este configurat. Căutarea necesită serverul proxy activ.');
  }

  if (!data) throw new Error('Date indisponibile momentan. Încearcă din nou.');

  cache.set(cacheKey, data);
  return data;
}

/**
 * Obţine bilanţurile pentru ultimii N ani
 */
async function getBilant(cui, ani = null) {
  cui = String(cui).replace(/\D/g, '');
  const currentYear = new Date().getFullYear();
  const yearsToFetch = ani || Array.from({length: 10}, (_, i) => currentYear - 1 - i);
  const cacheKey = `bilant_${cui}_${yearsToFetch[0]}`;
  const cached = cache.read(cacheKey);
  if (cached) return cached;

  let results = [];

  if (RAILWAY_URL) {
    try {
      const res = await fetch(`${RAILWAY_URL}/api/bilant/${cui}`, {
        signal: AbortSignal.timeout(30000)
      });
      if (res.ok) { const json = await res.json(); results = json.data || []; }
    } catch {}
  }

  // Dacă Railway nu a dat rezultate (fallback sau fără Railway) → direct ANAF
  if (!results.length && window.location.protocol !== 'file:') {
    for (const an of yearsToFetch) {
      try {
        const res = await fetch(`${ANAF_BASE}/bilant/rest/bilant.php?an=${an}&cui=${cui}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) continue;
        const json = await res.json();
        if (json?.i?.length > 0) results.push({ an, ...parseIndicatori(json.i) });
      } catch { /* skip year */ }
    }
  }

  results.sort((a, b) => a.an - b.an);
  cache.set(cacheKey, results, 86400000);
  return results;
}


/**
 * Parsează lista indicatori financiari din răspunsul ANAF
 */
function parseIndicatori(items) {
  const map = {};
  items.forEach(item => { map[item.indicator] = parseFloat(item.val_indicator) || 0; });

  return {
    // Cifra de afaceri
    cifraAfaceri: map['I2'] || map['CA'] || 0,
    // Profit net
    profitNet: map['I13'] || map['PN'] || 0,
    // Total active
    totalActive: map['I1'] || map['TA'] || 0,
    // Capitaluri proprii
    capitalPropriu: map['I10'] || map['CP'] || 0,
    // Datorii totale
    datoriiTotale: map['I6'] || map['DT'] || 0,
    // Numar angajati
    nrAngajati: map['I17'] || map['NA'] || 0,
    // Active circulante
    activeCirculante: map['I3'] || 0,
    // Stocuri
    stocuri: map['I4'] || 0,
    // Creante
    creante: map['I5'] || 0,
    // Casa si conturi
    casaConturi: map['I7'] || 0,
    // Datorii sub 1 an
    datoriiCurente: map['I8'] || 0,
    // Cheltuieli totale
    cheltuieliTotale: map['I12'] || 0,
    // Venituri totale
    venituriTotale: map['I11'] || 0,
    raw: map
  };
}

/**
 * Calculează scorul de risc folosind modelul Altman Z-Score adaptat
 * Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
 */
function calcRiskScore(bilantData) {
  if (!bilantData || bilantData.length === 0) return { score: 50, label: 'Necunoscut', level: 'med' };

  const latest = bilantData[bilantData.length - 1];
  const { totalActive, cifraAfaceri, profitNet, capitalPropriu, datoriiTotale, activeCirculante, datoriiCurente } = latest;

  if (totalActive === 0) return { score: 50, label: 'Date insuficiente', level: 'med' };

  const X1 = totalActive > 0 ? (activeCirculante - datoriiCurente) / totalActive : 0;
  const X2 = totalActive > 0 ? (capitalPropriu / totalActive) : 0;
  const X3 = totalActive > 0 ? (profitNet / totalActive) : 0;
  const X4 = datoriiTotale > 0 ? (capitalPropriu / datoriiTotale) : 1;
  const X5 = totalActive > 0 ? (cifraAfaceri / totalActive) : 0;

  const Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5;

  // Convertim Z-score în scor 0-100 (mai mare = mai bun)
  let score, label, level;
  if (Z > 2.9) { score = Math.min(95, 70 + Z * 5); label = 'Risc Scăzut'; level = 'low'; }
  else if (Z > 1.23) { score = Math.max(30, 40 + Z * 10); label = 'Risc Mediu'; level = 'med'; }
  else { score = Math.max(5, 20 + Z * 15); label = 'Risc Ridicat'; level = 'high'; }

  return { score: Math.round(Math.min(100, Math.max(0, score))), label, level, z: Z.toFixed(2) };
}

/**
 * Formatare numerică pentru sume
 */
function formatCurrency(val, decimals = 0) {
  if (!val && val !== 0) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(1) + ' mld RON';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2) + ' mil RON';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + ' mii RON';
  return n.toFixed(decimals) + ' RON';
}

function formatNumber(val) {
  if (!val && val !== 0) return '—';
  return parseInt(val).toLocaleString('ro-RO');
}

/**
 * Caută firme după denumire (fallback: regex pe localStorage recente)
 * Fără backend, returnează sugestii din cache-ul local
 */
async function cautaFirme(query) {
  // Dacă avem Railway backend → căutare reală după denumire
  if (RAILWAY_URL) {
    try {
      const res = await fetch(`${RAILWAY_URL}/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const json = await res.json();
        return json.data || [];
      }
    } catch {}
  }

  // Fallback: căutare locală în cache localStorage
  const localResults = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('firme_gen_')) {
      try {
        const d = JSON.parse(localStorage.getItem(key));
        if (d && d.val && d.val.denumire) {
          if (d.val.denumire.toLowerCase().includes(query.toLowerCase()) ||
              d.val.cui.toString().includes(query)) {
            localResults.push(d.val);
          }
        }
      } catch {}
    }
  }
  return localResults;
}

/**
 * Obține detalii extinse ONRC (via FirmeAPI.ro)
 * Returnează: nr_reg_com, cod_caen, stare, organ_fiscal, forma_organizare, tva, status_inactiv
 */
async function getDetalii(cui) {
  cui = String(cui).replace(/\D/g, '');
  if (!RAILWAY_URL) return null;

  const cacheKey = `detalii_${cui}`;
  const cached = cache.read(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${RAILWAY_URL}/api/detalii/${cui}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        cache.set(cacheKey, json.data, 3600000);
        return json.data;
      }
    }
  } catch {}
  return null;
}

/**
 * Obține lista administratorilor firmei (via FirmeAPI.ro)
 * Returnează: { administratori: [{nume, tip, stare, data}], denumire, nr_reg_com, stare, adresa }
 */
async function getAdministratori(cui) {
  cui = String(cui).replace(/\D/g, '');
  if (!RAILWAY_URL) return null;

  const cacheKey = `admin_${cui}`;
  const cached = cache.read(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${RAILWAY_URL}/api/administratori/${cui}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        cache.set(cacheKey, json.data, 21600000); // 6h
        return json.data;
      }
    }
  } catch {}
  return null;
}

// Exporturi globale
window.FirmeAPI = {
  getDateGenerale,
  getDetalii,
  getAdministratori,
  getBilant,
  calcRiskScore,
  formatCurrency,
  formatNumber,
  cautaFirme,
  parseIndicatori
};
