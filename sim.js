/* Mesin simulasi MM5 vs counterparty.
 * Satu "trade" = satu flow di Excel: MM5 beli koin (buy), lalu jual (sell) ke counterparty.
 * Semua tarif berupa pecahan (0.0018 = 0,18%). Dipakai browser (window.Sim) dan Node (require).
 */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const uni = (r, a, b) => a + (b - a) * r();
  const randInt = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const logUni = (r, a, b) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * r());

  /* Satu flow persis seperti rumus Excel + versi laba bersih (kas riil). */
  function flow(vol, buy, sell, rate) {
    const { gk, pph, cfx } = rate;
    const E = vol / buy;                       // koin dibeli (kotor)
    const Enet = E * (1 - gk - cfx);           // fee beli dipotong dalam koin (Excel E14)
    const gross = sell * Enet;                 // hasil jual kotor (Excel C14)
    // sisi MM5
    const mm = {
      buyGK: vol * gk, buyCFX: vol * cfx,
      sellGK: gross * gk, sellTax: gross * pph, sellCFX: gross * cfx,
    };
    mm.pnl = gross - mm.sellGK - mm.sellTax - mm.sellCFX - vol;   // kas riil: terima - bayar
    // gain versi Excel (net jual tidak dikurangi pajak, pembanding = net beli setelah fee)
    const excelNetBuy = vol - mm.buyGK - mm.buyCFX;
    const excelNetSell = gross - mm.sellGK - mm.sellCFX;
    mm.excelGain = excelNetSell - excelNetBuy;
    // sisi counterparty (independen): jual di leg beli, beli di leg jual
    const cp = {
      sellGK: vol * gk, sellTax: vol * pph, sellCFX: vol * cfx,
      buyGK: gross * gk, buyCFX: gross * cfx,
    };
    // cp menyerahkan E koin, menerima kembali Enet koin; selisih koin dinilai di harga jual
    cp.pnl = -E * (sell - buy) - cp.sellGK - cp.sellTax - cp.sellCFX - cp.buyGK - cp.buyCFX;
    // pendapatan exchange & negara dari kedua sisi
    const ex = {
      gk: mm.buyGK + mm.sellGK + cp.sellGK + cp.buyGK,
      tax: mm.sellTax + cp.sellTax,
      cfx: mm.buyCFX + mm.sellCFX + cp.sellCFX + cp.buyCFX,
    };
    return { E, Enet, gross, mm, cp, ex, turnover: vol + gross };
  }

  function simulate(p, seed) {
    const r = mulberry32(seed >>> 0);
    const rate = { gk: p.gk, pph: p.pph, cfx: p.cfx };
    let cash = p.capital, cum = 0, peak = 0, maxDD = 0;
    const trades = [], days = [];
    const tot = { gk: 0, tax: 0, cfx: 0, turnover: 0, cpPnl: 0, wins: 0, losses: 0, skipped: 0 };
    let hitDay = null;

    for (let d = 1; d <= p.days; d++) {
      const n = randInt(r, p.minTrades, p.maxTrades);
      const day = { day: d, n: 0, gk: 0, tax: 0, cfx: 0, pnl: 0 };
      for (let i = 1; i <= n; i++) {
        const volWanted = logUni(r, p.volMin, p.volMax);
        const win = r() < p.winRate;
        const move = win ? uni(r, p.winMin, p.winMax) : -uni(r, p.loseMin, p.loseMax);
        const buy = p.buyPrice * (1 + p.jitter * (r() * 2 - 1));
        const sell = buy * (1 + move);
        const vol = Math.min(volWanted, cash);
        if (vol < p.volMin * 0.1) { tot.skipped++; continue; }   // dana habis
        const f = flow(vol, buy, sell, rate);
        cash += f.mm.pnl; cum += f.mm.pnl;
        peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum);
        win ? tot.wins++ : tot.losses++;
        tot.gk += f.ex.gk; tot.tax += f.ex.tax; tot.cfx += f.ex.cfx;
        tot.turnover += f.turnover; tot.cpPnl += f.cp.pnl;
        day.n++; day.gk += f.ex.gk; day.tax += f.ex.tax; day.cfx += f.ex.cfx; day.pnl += f.mm.pnl;
        trades.push({ day: d, no: i, vol, buy, sell, move, win, cash, cum, ...f });
      }
      day.cum = cum; day.cash = cash;
      if (hitDay === null && cum >= p.target) hitDay = d;
      days.push(day);
    }
    return { trades, days, tot, final: cum, cash, maxDD, hitDay };
  }

  function monteCarlo(p, seed, n) {
    const finals = [];
    let hit = 0, loss = 0, ddSum = 0;
    for (let k = 0; k < n; k++) {
      const s = simulate(p, seed + 7919 * (k + 1));
      finals.push(s.final);
      if (s.hitDay !== null) hit++;
      if (s.final < 0) loss++;
      ddSum += s.maxDD;
    }
    const sorted = finals.slice().sort((a, b) => a - b);
    const q = x => sorted[Math.min(n - 1, Math.max(0, Math.floor(x * (n - 1))))];
    return { n, finals, hit, loss, p10: q(0.1), p50: q(0.5), p90: q(0.9),
             min: sorted[0], max: sorted[n - 1], avgDD: ddSum / n };
  }

  const api = { mulberry32, flow, simulate, monteCarlo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
