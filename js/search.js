/**
 * search.js — Autocomplete și căutare
 */
function initSearch(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = input.value.trim();
    if (val.length < 2) { dropdown.classList.remove('visible'); return; }
    debounceTimer = setTimeout(() => showSuggestions(val, dropdown), 300);
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('visible');
    }
  });
}

async function showSuggestions(query, dropdown) {
  const isCUI = /^\d{4,}$/.test(query.replace(/\s/g,''));

  if (isCUI) {
    const cui = query.replace(/\D/g,'');
    dropdown.innerHTML = `<div class="search-dropdown-item" onclick="window.location.href='firma.html?cui=${cui}'">
      <div class="item-icon">🔍</div>
      <div><div class="item-name">Caută CUI ${cui}</div>
      <div class="item-cui">Apasă Enter sau click pentru detalii</div></div>
    </div>`;
    dropdown.classList.add('visible');
    return;
  }

  // Căutare locală în cache
  const local = await FirmeAPI.cautaFirme(query);
  if (local.length > 0) {
    dropdown.innerHTML = local.slice(0,6).map(f => `
      <div class="search-dropdown-item" onclick="window.location.href='firma.html?cui=${f.cui}'">
        <div class="item-icon">🏢</div>
        <div>
          <div class="item-name">${highlight(f.denumire, query)}</div>
          <div class="item-cui">CUI ${f.cui} &bull; ${f.adresa || ''}</div>
        </div>
        <span class="item-status ${f.stare==='ACTIV' ? 'status-active':'status-inactive'}">${f.stare||'—'}</span>
      </div>`).join('');
    dropdown.classList.add('visible');
  } else {
    dropdown.innerHTML = `<div class="search-dropdown-item" style="cursor:default;opacity:.6">
      <div class="item-icon">ℹ️</div>
      <div><div class="item-name">Introdu CUI-ul firmei</div>
      <div class="item-cui">Căutarea după denumire necesită CUI cunoscut</div></div>
    </div>`;
    dropdown.classList.add('visible');
  }
}

function highlight(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0,idx) + `<mark style="background:rgba(99,102,241,.3);color:inherit;border-radius:2px">${text.slice(idx,idx+query.length)}</mark>` + text.slice(idx+query.length);
}

function saveRecentSearch(cui, denumire) {
  try {
    let recent = JSON.parse(localStorage.getItem('firme_recent') || '[]');
    recent = recent.filter(r => r.cui !== cui);
    recent.unshift({ cui, denumire, ts: Date.now() });
    recent = recent.slice(0,8);
    localStorage.setItem('firme_recent', JSON.stringify(recent));
  } catch {}
}

function loadRecentSearches() {
  try {
    const recent = JSON.parse(localStorage.getItem('firme_recent') || '[]');
    const section = document.getElementById('recentSection');
    const list = document.getElementById('recentList');
    if (!section || !list || recent.length === 0) return;
    section.style.display = 'block';
    list.innerHTML = recent.map(r => `
      <div class="recent-chip" onclick="window.location.href='firma.html?cui=${r.cui}'">
        🏢 ${r.denumire || 'CUI '+r.cui}
        <span class="chip-remove" onclick="removeRecent('${r.cui}',event)">✕</span>
      </div>`).join('');
  } catch {}
}

function removeRecent(cui, e) {
  e.stopPropagation();
  try {
    let recent = JSON.parse(localStorage.getItem('firme_recent') || '[]');
    recent = recent.filter(r => r.cui !== cui);
    localStorage.setItem('firme_recent', JSON.stringify(recent));
    loadRecentSearches();
  } catch {}
}
