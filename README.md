# simulasi-perikhitiw

Dashboard simulasi MM5 (HTML statis, tanpa dependensi). Buka `index.html` di browser.

- Maksimal 4 trade per hari (jumlah acak antara min dan maks), volume tiap trade acak, hasil menang/kalah acak.
- Satu trade = satu flow di `hitungan draft.xlsx`: MM5 beli koin, lalu jual ke counterparty.
- Menampilkan income exchange (fee GK), pajak (PPN/PPh 0,21%), fee CFX, laba bersih MM5, dan hasil counterparty (dicatat terpisah, bukan modal MM5).
- Monte Carlo 500 simulasi untuk peluang capai target; ekspor CSV rincian trade.
- Tarif disalin dari draft Excel dan belum diverifikasi sebagai tarif berlaku.

`sim.js` adalah mesin hitung; `node test.js` mencocokkan hasilnya dengan nilai Excel (butuh file xlsx di path yang tertera di test).
