const { flow, simulate, monteCarlo } = require('./sim.js');
const rate = { gk: 0.0018, pph: 0.0021, cfx: 0.0000555 };
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
let ok = true;
const chk = (name, got, want, tol) => { const p = near(got, want, tol); ok = ok && p; console.log(p ? 'OK  ' : 'FAIL', name, got.toFixed(2), want.toFixed(2)); };

// referensi Excel (Sheet1): flow 1-4 dan gain di I16/I25/I33/I40
const ref = [[200e6, 285000, 77388998.75], [250e6, 285000, null], [325e6, 285000, null], [1e6, 195000, null]];
const f1 = flow(200e6, 205000, 285000, rate);
chk('flow1 gain Excel', f1.mm.excelGain, 77388998.75);
chk('flow1 laba bersih', f1.mm.pnl, 76435079.74);
chk('flow1 hasil jual kotor - pajak - fee', f1.gross - f1.mm.sellGK - f1.mm.sellTax - f1.mm.sellCFX, 276435079.74);

// nilai cache Excel untuk flow lain
const py = require('child_process').execSync(
  `python3 -I -c "import openpyxl;ws=openpyxl.load_workbook('/mnt/user-data/uploads/03fd9b00-hitungan_draft_1.xlsx',data_only=True)['Sheet1'];print(ws['I16'].value,ws['I25'].value,ws['I33'].value,ws['I40'].value,ws['M22'].value,ws['N22'].value,ws['O22'].value)"`).toString().trim().split(' ').map(Number);
console.log('cache Excel', py);
[[200e6,285000],[250e6,285000],[325e6,285000],[1e6,195000]].forEach(([v,s],i)=>{
  const f = flow(v,205000,s,rate); if(!isNaN(py[i])) chk('gain Excel flow'+(i+1), f.mm.excelGain, py[i], 0.05);
});

// konservasi: MM5 + CP + exchange + pajak + CFX = selisih valuasi fee koin (E-Enet)*(sell-buy... ) 
const f = flow(100e6, 200000, 230000, rate);
const resid = f.mm.pnl + f.cp.pnl + f.ex.gk + f.ex.tax + f.ex.cfx;
const coinFeeVal = (f.E - f.Enet) * (230000 - 200000) ; // buy-fee dinilai harga beli vs jual
console.log('residual rekonsiliasi', resid.toFixed(2), 'selisih valuasi', coinFeeVal.toFixed(2));

// simulasi
const p = { capital:450e6,target:373.5e6,days:30,minTrades:1,maxTrades:4,volMin:10e6,volMax:150e6,
  winRate:.55,winMin:.05,winMax:.25,loseMin:.03,loseMax:.12,buyPrice:205000,jitter:.02,...rate };
const s = simulate(p, 12345);
console.log('trades', s.trades.length, 'maxPerDay', Math.max(...s.days.map(d=>d.n)), 'final', Math.round(s.final), 'wins', s.tot.wins, 'losses', s.tot.losses);
console.log('cash min', Math.min(...s.trades.map(t=>t.cash)).toFixed(0), 'vol min/max', Math.min(...s.trades.map(t=>t.vol)).toFixed(0), Math.max(...s.trades.map(t=>t.vol)).toFixed(0));
const a = simulate(p, 12345); console.log('deterministik', a.final === s.final);
const mc = monteCarlo(p, 1, 300); console.log('MC hit', mc.hit, 'loss', mc.loss, 'p10/50/90', [mc.p10,mc.p50,mc.p90].map(Math.round));
// kas tidak boleh negatif walau kalah
const q = simulate({...p, winRate:0, loseMin:.3, loseMax:.5, days:60}, 9);
console.log('all-lose: cash min', Math.min(...q.trades.map(t=>t.cash)).toFixed(0), 'skipped', q.tot.skipped);

{ const f=flow(100e6,205000,250000,rate); const e=f.ex;
  chk('GK: Rp + koin setara = total', e.gkRp+e.gkCoinRp, e.gk, 0.001);
  chk('CFX: Rp + koin setara = total', e.cfxRp+e.cfxCoinRp, e.cfx, 0.001);
  chk('koin fee GK dinilai harga beli/jual', e.gkCoin>0 ? (f.E*rate.gk*205000 + f.Enet*rate.gk*250000) : 0, e.gkCoinRp, 0.01); }
process.exit(ok ? 0 : 1);
