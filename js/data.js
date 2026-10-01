// VERİ KATMANI — sayfalar yalnızca API.* kullanır. Gerçek fiyatlar data/prices.json'dan gelir
// (scripts/fetch-prices.mjs üretir). Geçmiş serisi ve tahmin henüz örnek veridir.
const FUELS = {
  benzin:  { key: 'benzin',  name: 'Benzin 95', short: 'Benzin', base: 84.5, color: '#ff6b4a', icon: 'fuel' },
  motorin: { key: 'motorin', name: 'Motorin',   short: 'Motorin', base: 97.1, color: '#4db2ff', icon: 'droplets' },
  lpg:     { key: 'lpg',     name: 'LPG',       short: 'LPG', base: 36.4, color: '#3ddc97', icon: 'flame' },
};
const FUEL_KEYS = Object.keys(FUELS);
const BRANDS = [{ n: 'Opet' }, { n: 'Petrol Ofisi' }, { n: 'Aytemiz' }];
function slug(s) { return s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-'); }
const CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep', 'Kayseri', 'Eskişehir', 'Trabzon', 'Samsun', 'Diyarbakır', 'Mersin', 'Muğla']
  .map(n => ({ n, s: slug(n) }));
const cityByName = n => CITIES.find(c => c.n === n) || CITIES[0];
const cityBySlug = s => CITIES.find(c => c.s === s);

const num = n => (n == null || isNaN(n)) ? '—' : n.toFixed(2).replace('.', ',');
const tl = n => (n == null || isNaN(n)) ? '—' : num(n) + ' ₺';

// ---- Gerçek veri yükleme ----
let REAL = null;
const DATA_READY = fetch('data/prices.json').then(r => r.json()).then(d => {
  REAL = d;
  FUEL_KEYS.forEach(f => { const v = rawPrice(f, 'İstanbul'); if (v) FUELS[f].base = +v.toFixed(2); });
}).catch(() => { REAL = null; })
  .then(() => fetch('data/history.json').then(r => r.json()).then(h => { HIST = h; }).catch(() => {}));
let HIST = {};
const dataInfo = () => REAL && { updatedAt: REAL.updatedAt, sources: REAL.sources };

// brand verilmezse markaların ortalaması (il referans fiyatı)
function rawPrice(f, city, brand = null) {
  const c = REAL?.cities[city]; if (!c) return null;
  if (brand) return c.brands[brand]?.[f] ?? null;
  const v = Object.values(c.brands).map(b => b[f]).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b) / v.length : null;
}
const priceOf = (f, city = 'İstanbul', brand = null) => {
  const r = rawPrice(f, city, brand);
  if (r == null) return brand ? null : +FUELS[f].base.toFixed(2);
  const o = Store.get('override', {})[f];   // admin manuel fiyatı: İstanbul referansına göre tüm şehirlere kaydırır
  return +(r + (o != null ? o - (rawPrice(f, 'İstanbul') ?? FUELS[f].base) : 0)).toFixed(2);
};

function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
// 365 günlük basamaklı seri (ÖRNEK veri: zam/indirimle değişen, bugünkü gerçek fiyatta biten)
const _hist = {};
function series(f) {
  if (_hist[f]) return _hist[f];
  const rnd = seeded(f.length * 977 + 31), scale = FUELS[f].base * .011;
  const out = []; let v = FUELS[f].base;
  for (let i = 0; i < 365; i++) {
    out.unshift(+v.toFixed(2));
    if (rnd() < .2) v -= (rnd() - .46) * 2 * scale * (1 + rnd());
  }
  return (_hist[f] = out);
}
const dayLabel = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); };
const isoDay = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toISOString().slice(0, 10); };

function makeForecast(f, n = 7) {
  const s = series(f), last = s.slice(-21), slope = (last.at(-1) - last[0]) / 20, vol = FUELS[f].base * .004;
  const mid = [], lo = [], hi = [];
  for (let i = 1; i <= n; i++) {
    const v = s.at(-1) + slope * i * .7 + Math.sin(i * 1.3) * vol * .5;
    mid.push(+v.toFixed(2)); lo.push(+(v - vol * Math.sqrt(i) * 2).toFixed(2)); hi.push(+(v + vol * Math.sqrt(i) * 2).toFixed(2));
  }
  const diff = mid.at(-1) - s.at(-1);
  return { mid, lo, hi, diff, conf: Math.round(78 - Math.abs(diff) * 3),
    dir: Math.abs(diff) < FUELS[f].base * .002 ? 'flat' : diff > 0 ? 'up' : 'down' };
}
function realDiff(f, city) {
  const days = Object.keys(HIST).sort(); if (days.length < 2) return null;
  const avg = d => { const v = Object.values(HIST[d]?.[city] ?? {}).map(b => b[f]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b) / v.length : null; };
  const a = avg(days.at(-1)), b = avg(days.at(-2));
  return a == null || b == null ? null : +(a - b).toFixed(2);
}
function lastChangeAge(f) { const s = series(f); let i = s.length - 1; while (i > 0 && s[i] === s[i - 1]) i--; return s.length - 1 - i; }

const delay = (fn) => DATA_READY.then(fn);
const API = {
  cities: () => delay(() => CITIES),
  info: () => delay(dataInfo),
  // Güncel fiyatlar: { benzin:{price,diff}, ... }  diff = önceki günlük kayda göre gerçek değişim; kayıt yoksa null
  prices: (city) => delay(() => Object.fromEntries(FUEL_KEYS.map(f => [f, { price: priceOf(f, city), diff: realDiff(f, city) }]))),
  history: (f, days = 30) => delay(() => ({ values: series(f).slice(-days), labels: Array.from({ length: days }, (_, i) => dayLabel(days - 1 - i)) })),
  forecast: (f, n = 7) => delay(() => ({ ...makeForecast(f, n), labels: Array.from({ length: n }, (_, i) => dayLabel(-(i + 1))) })),
  // Markalar: bir markada olmayan yakıt null döner (ör. Opet LPG)
  brands: (city) => delay(() => BRANDS.map(b => ({ name: b.n, ...Object.fromEntries(FUEL_KEYS.map(f => [f, priceOf(f, city, b.n)])) })).filter(b => FUEL_KEYS.some(f => b[f] != null))),
  ranking: (f) => delay(() => CITIES.map(c => ({ city: c.n, slug: c.s, price: priceOf(f, c.n) })).sort((a, b) => a.price - b.price)),
  // İlçe bazlı gerçek Opet fiyatları
  districts: (city) => delay(() => (REAL?.cities[city]?.districts ?? []).map(d => ({ name: d.name, benzin: d.benzin, motorin: d.motorin }))),
  changes: (f = null, limit = 8, days = 180) => delay(() => {
    const keys = f ? [f] : FUEL_KEYS, out = [];
    keys.forEach(k => { const s = series(k); for (let i = s.length - 1; i > s.length - days; i--) if (s[i] !== s[i - 1]) out.push({ fuel: k, date: isoDay(s.length - 1 - i), from: s[i - 1], to: s[i], diff: +(s[i] - s[i - 1]).toFixed(2), ago: s.length - 1 - i }); });
    return out.sort((a, b) => a.ago - b.ago).slice(0, limit);
  }),
};
