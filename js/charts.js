/**
 * charts.js — Grafice Chart.js pentru FirmeRO
 */

let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function buildYears(bilantData) { return bilantData.map(b => b.an); }

const CHART_DEFAULTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, boxWidth: 12 } } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } }
  }
};

function formatAxisVal(val) {
  if (Math.abs(val) >= 1e6) return (val/1e6).toFixed(1)+'M';
  if (Math.abs(val) >= 1e3) return (val/1e3).toFixed(0)+'K';
  return val;
}

function renderCAChart(canvasId, bilantData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = buildYears(bilantData);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Cifră Afaceri (RON)',
          data: bilantData.map(b => b.cifraAfaceri),
          backgroundColor: 'rgba(99,102,241,0.7)',
          borderColor: '#6366f1', borderWidth: 1, borderRadius: 6
        },
        {
          label: 'Profit Net (RON)',
          data: bilantData.map(b => b.profitNet),
          backgroundColor: 'rgba(16,185,129,0.6)',
          borderColor: '#10b981', borderWidth: 1, borderRadius: 6
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${FirmeAPI.formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        ...CHART_DEFAULTS.scales,
        y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: formatAxisVal } }
      }
    }
  });
}

function renderAngajatiChart(canvasId, bilantData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: buildYears(bilantData),
      datasets: [{
        label: 'Număr Angajați',
        data: bilantData.map(b => b.nrAngajati),
        borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)',
        fill: true, tension: 0.4, pointRadius: 5,
        pointBackgroundColor: '#06b6d4'
      }]
    },
    options: { ...CHART_DEFAULTS }
  });
}

function renderStructuraChart(canvasId, bilantData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const latest = bilantData[bilantData.length - 1];
  if (!latest) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Capital Propriu','Datorii Curente','Alte Datorii'],
      datasets: [{
        data: [
          Math.max(0, latest.capitalPropriu),
          Math.max(0, latest.datoriiCurente),
          Math.max(0, latest.datoriiTotale - latest.datoriiCurente)
        ],
        backgroundColor: ['rgba(99,102,241,0.8)','rgba(239,68,68,0.7)','rgba(245,158,11,0.7)'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font:{family:'Inter',size:11}, boxWidth:12 } } }
    }
  });
}

function renderEvolutieChart(canvasId, bilantData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: buildYears(bilantData),
      datasets: [
        {
          label: 'Active Totale',
          data: bilantData.map(b => b.totalActive),
          borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.05)',
          fill: true, tension: 0.4
        },
        {
          label: 'Datorii Totale',
          data: bilantData.map(b => b.datoriiTotale),
          borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)',
          fill: true, tension: 0.4
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { callback: formatAxisVal, color:'#94a3b8', font:{family:'Inter',size:11} } } }
    }
  });
}
