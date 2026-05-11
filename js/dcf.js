/**
 * dcf.js — Discounted Cash Flow Valuation Engine for FirmeRO
 * Uses ANAF bilanț data + BVB stock price to compute intrinsic value
 */

const DCF = {
  /**
   * Calculate DCF valuation
   * @param {Object} params
   * @param {number[]} params.revenues - Array of annual revenues (latest last)
   * @param {number[]} params.ebit - Array of annual EBIT/operating profit
   * @param {number[]} params.depreciation - Array of annual D&A
   * @param {number[]} params.capex - Array of annual CapEx (positive = spending)
   * @param {number[]} params.nwcChanges - Array of ΔNet Working Capital
   * @param {number} params.totalDebt - Current total debt
   * @param {number} params.cash - Current cash & equivalents
   * @param {number} params.sharesOutstanding - Number of shares
   * @param {number} params.currentPrice - Current stock price (BVB)
   * @param {number} [params.wacc=0.12] - Weighted avg cost of capital
   * @param {number} [params.terminalGrowth=0.03] - Terminal growth rate
   * @param {number} [params.taxRate=0.16] - Corporate tax rate (RO = 16%)
   * @param {number} [params.forecastYears=5] - Projection period
   * @param {number} [params.revenueGrowth] - Override revenue growth (auto if null)
   * @param {number} [params.ebitMargin] - Override EBIT margin (auto if null)
   * @returns {Object} DCF result with EV, equity value, fair value, upside
   */
  calculate(params) {
    const {
      revenues = [],
      ebit = [],
      depreciation = [],
      capex = [],
      nwcChanges = [],
      totalDebt = 0,
      cash = 0,
      sharesOutstanding = 1,
      currentPrice = 0,
      wacc = 0.12,
      terminalGrowth = 0.03,
      taxRate = 0.16,
      forecastYears = 5,
    } = params;

    // --- Auto-calculate growth & margins from historical data ---
    const n = revenues.length;
    
    // Revenue growth: CAGR from available years
    let revenueGrowth = params.revenueGrowth;
    if (revenueGrowth == null && n >= 2) {
      const firstNonZero = revenues.find(r => r > 0) || 1;
      const lastRev = revenues[n - 1] || 1;
      revenueGrowth = Math.pow(lastRev / firstNonZero, 1 / (n - 1)) - 1;
      // Cap growth to reasonable range
      revenueGrowth = Math.max(-0.1, Math.min(0.5, revenueGrowth));
    } else if (revenueGrowth == null) {
      revenueGrowth = 0.05; // default 5%
    }

    // EBIT margin: average of available years
    let ebitMargin = params.ebitMargin;
    if (ebitMargin == null && n >= 1) {
      const margins = ebit.map((e, i) => revenues[i] > 0 ? e / revenues[i] : 0).filter(m => m !== 0);
      ebitMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0.1;
      ebitMargin = Math.max(0.01, Math.min(0.6, ebitMargin));
    } else if (ebitMargin == null) {
      ebitMargin = 0.1;
    }

    // D&A as % of revenue (average)
    let daRatio = 0.03;
    if (n >= 1) {
      const ratios = depreciation.map((d, i) => revenues[i] > 0 ? d / revenues[i] : 0).filter(r => r > 0);
      if (ratios.length > 0) daRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    }

    // CapEx as % of revenue (average)
    let capexRatio = 0.04;
    if (capex.length >= 1) {
      const ratios = capex.map((c, i) => revenues[i] > 0 ? Math.abs(c) / revenues[i] : 0).filter(r => r > 0);
      if (ratios.length > 0) capexRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    }

    // NWC change as % of revenue delta
    let nwcRatio = 0.02;
    if (nwcChanges.length >= 1 && n >= 2) {
      const ratios = nwcChanges.map((nwc, i) => {
        const revDelta = i > 0 ? Math.abs(revenues[i] - revenues[i - 1]) : Math.abs(revenues[i]);
        return revDelta > 0 ? Math.abs(nwc) / revDelta : 0;
      }).filter(r => r > 0 && r < 1);
      if (ratios.length > 0) nwcRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    }

    // --- Project Free Cash Flows ---
    const baseRevenue = revenues[n - 1] || 0;
    const projectedFCF = [];
    const projectedRevenue = [];
    const projectedEBIT = [];
    
    for (let t = 1; t <= forecastYears; t++) {
      const rev = baseRevenue * Math.pow(1 + revenueGrowth, t);
      const ebitVal = rev * ebitMargin;
      const nopat = ebitVal * (1 - taxRate); // Net Operating Profit After Tax
      const da = rev * daRatio;
      const cx = rev * capexRatio;
      const revPrev = t === 1 ? baseRevenue : baseRevenue * Math.pow(1 + revenueGrowth, t - 1);
      const deltaNWC = (rev - revPrev) * nwcRatio;
      
      const fcf = nopat + da - cx - deltaNWC;
      projectedFCF.push(fcf);
      projectedRevenue.push(rev);
      projectedEBIT.push(ebitVal);
    }

    // --- Terminal Value (Perpetuity Growth Method) ---
    const lastFCF = projectedFCF[forecastYears - 1] || 0;
    const terminalValue = lastFCF * (1 + terminalGrowth) / (wacc - terminalGrowth);

    // --- Discount to Present Value ---
    let pvFCF = 0;
    const pvDetails = [];
    for (let t = 0; t < forecastYears; t++) {
      const discountFactor = Math.pow(1 + wacc, t + 1);
      const pv = projectedFCF[t] / discountFactor;
      pvFCF += pv;
      pvDetails.push({
        year: t + 1,
        revenue: projectedRevenue[t],
        ebit: projectedEBIT[t],
        fcf: projectedFCF[t],
        pv: pv,
        discountFactor: discountFactor
      });
    }

    const pvTerminal = terminalValue / Math.pow(1 + wacc, forecastYears);
    const enterpriseValue = pvFCF + pvTerminal;

    // --- Equity Value ---
    const netDebt = totalDebt - cash;
    const equityValue = enterpriseValue - netDebt;
    const fairValuePerShare = sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0;

    // --- Upside/Downside ---
    const upside = currentPrice > 0 ? (fairValuePerShare / currentPrice - 1) : 0;

    // --- Verdict ---
    let verdict, verdictColor;
    if (upside > 0.20) { verdict = 'Subevaluată'; verdictColor = '#10b981'; }
    else if (upside > -0.10) { verdict = 'Evaluare Corectă'; verdictColor = '#f59e0b'; }
    else { verdict = 'Supraevaluată'; verdictColor = '#ef4444'; }

    return {
      // Inputs used
      inputs: {
        revenueGrowth,
        ebitMargin,
        wacc,
        terminalGrowth,
        taxRate,
        forecastYears,
        daRatio,
        capexRatio,
        nwcRatio
      },
      // Projection details
      projections: pvDetails,
      // Terminal value
      terminalValue,
      pvTerminal,
      // Totals
      pvFCF,
      enterpriseValue,
      netDebt,
      equityValue,
      fairValuePerShare,
      currentPrice,
      upside,
      verdict,
      verdictColor
    };
  },

  /**
   * Extract DCF inputs from ANAF bilanț data
   * @param {Array} bilantData - Array of annual financial data from ANAF
   * @returns {Object} Structured data for DCF calculation
   */
  extractFromBilant(bilantData) {
    if (!bilantData || !bilantData.length) return null;

    // Sort by year ascending
    const sorted = [...bilantData].sort((a, b) => (a.an || 0) - (b.an || 0));

    const revenues = [];
    const ebit = [];
    const depreciation = [];
    const capex = [];
    const nwcChanges = [];
    let totalDebt = 0;
    let cash = 0;

    let prevFixedAssets = null;
    let prevNWC = null;

    for (const b of sorted) {
      // Revenue = cifra de afaceri (camelCase from backend)
      const rev = Math.abs(b.cifraAfaceri || b.cifra_afaceri || 0);
      revenues.push(rev);

      // EBIT = profit din exploatare, fallback to profitNet / (1 - taxRate) as proxy
      let operatingProfit = b.profitExploatare || b.profit_exploatare || 0;
      if (operatingProfit === 0 && (b.profitNet || b.profit_net)) {
        // Approximate EBIT from net profit (gross up by 16% tax rate)
        operatingProfit = (b.profitNet || b.profit_net || 0) / 0.84;
      }
      ebit.push(operatingProfit);

      // D&A - estimate as ~4% of revenue if not available
      const da = Math.abs(rev * 0.04);
      depreciation.push(da);

      // CapEx estimate from change in fixed assets + depreciation
      const fixedAssets = Math.abs(b.activeImobilizate || b.active_imobilizate || 0);
      if (prevFixedAssets !== null) {
        const estimatedCapex = (fixedAssets - prevFixedAssets) + da;
        capex.push(Math.max(0, estimatedCapex));
      } else {
        capex.push(da * 1.2); // rough estimate for first year
      }
      prevFixedAssets = fixedAssets;

      // Net Working Capital = Current Assets - Current Liabilities
      const currentAssets = Math.abs(b.activeCirculante || b.active_circulante || 0);
      const currentLiabilities = Math.abs(b.datoriiCurente || b.datorii_curente || 0);
      const nwc = currentAssets - currentLiabilities;
      if (prevNWC !== null) {
        nwcChanges.push(nwc - prevNWC);
      } else {
        nwcChanges.push(0);
      }
      prevNWC = nwc;

      // Total debt & cash (latest year values)
      totalDebt = Math.abs(b.datoriiTotale || b.datorii_totale || 0);
      cash = Math.abs(b.casaConturi || b.disponibilitati || 0);
    }

    return { revenues, ebit, depreciation, capex, nwcChanges, totalDebt, cash };
  },

  /**
   * Format a number as RON currency
   */
  formatRON(value) {
    if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + ' mld RON';
    if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + ' mil RON';
    if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(0) + ' K RON';
    return value.toFixed(2) + ' RON';
  }
};

// Export for use in other scripts
if (typeof window !== 'undefined') window.DCF = DCF;
