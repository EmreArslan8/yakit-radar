// VERİ KATMANI — sayfalar yalnızca API.* kullanır. Gerçek entegrasyonda sadece bu dosya değişir.
const FUELS = {
  benzin:  { key: 'benzin',  name: 'Benzin 95', short: 'Benzin', base: 58.42, color: '#ff8a3d', icon: 'fuel' },
  motorin: { key: 'motorin', name: 'Motorin',   short: 'Motorin', base: 56.18, color: '#4db2ff', icon: 'droplets' },
  lpg:     { key: 'lpg',     name: 'LPG',       short: 'LPG', base: 27.35, color: '#3ddc97', icon: 'flame' },
};
const FUEL_KEYS = Object.keys(FUELS);
const CITIES = [
  ['İstanbul', 0], ['Ankara', -.35], ['İzmir', -.2], ['Bursa', -.25], ['Antalya', .1], ['Adana', -.3], ['Konya', -.5],
  ['Gaziantep', -.35], ['Kayseri', -.45], ['Eskişehir', -.4], ['Trabzon', .25], ['Samsun', -.1], ['Diyarbakır', .15],
  ['Mersin', -.15], ['Muğla', .2],
].map(([n, o]) => ({ n, o, s: slug(n) }));
const BRANDS = [['Opet', 0], ['Petrol Ofisi', .3], ['BP', .4], ['Shell', .55], ['Total', .15], ['Aytemiz', -.25]]
  .map(([n, o]) => ({ n, o }));
const DISTRICTS = ['Merkez', 'Çarşı', 'Sanayi', 'Cumhuriyet', 'Yeni Mahalle', 'Terminal', 'Çevre Yolu', 'Atatürk Bulvarı', 'Organize Sanayi', 'Havalimanı Yolu', 'Üniversite', 'Sahil'];

function slug(s) { return s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-'); }
const cityByName = n => CITIES.find(c => c.n === n) || CITIES[0];
const cityBySlug = s => CITIES.find(c => c.s === s);

const num = n => n.toFixed(2).replace('.', ',');
const tl = n => num(n) + ' ₺';

function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const baseOf = f => (Store.get('override', {})[f] ?? FUELS[f].base);
const cityOff = (f, city) => cityByName(city).o * (f === 'lpg' ? .45 : 1);
const brandOff = (f, brand) => (BRANDS.find(b => b.n === brand)?.o ?? 0) * (f === 'lpg' ? .3 : 1);
const priceOf = (f, city = 'İstanbul', brand = 'Opet') => +(baseOf(f) + cityOff(f, city) + brandOff(f, brand)).toFixed(2);

// 365 günlük basamaklı seri (akaryakıt fiyatları günlük değil, zam/indirimle değişir)
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

const delay = (v) => new Promise(r => setTimeout(() => r(v), 60));
const API = {
  cities: () => delay(CITIES),
  // Güncel fiyatlar: { benzin:{price,prev,diff}, ... }
  prices: (city) => delay(Object.fromEntries(FUEL_KEYS.map(f => {
    const s = series(f), now = priceOf(f, city), d = s.at(-1) - s[s.length - 2 - lastChangeAge(f)];
    return [f, { price: now, prev: +(now - d).toFixed(2), diff: +d.toFixed(2), age: lastChangeAge(f) }];
  }))),
  history: (f, days = 30) => delay({ values: series(f).slice(-days), labels: Array.from({ length: days }, (_, i) => dayLabel(days - 1 - i)) }),
  forecast: (f, n = 7) => delay({ ...makeForecast(f, n), labels: Array.from({ length: n }, (_, i) => dayLabel(-(i + 1))) }),
  brands: (city) => delay(BRANDS.map(b => ({ name: b.n, ...Object.fromEntries(FUEL_KEYS.map(f => [f, priceOf(f, city, b.n)])) }))),
  ranking: (f) => delay(CITIES.map(c => ({ city: c.n, slug: c.s, price: priceOf(f, c.n) })).sort((a, b) => a.price - b.price)),
  // Zam/indirim kayıtları
  changes: (f = null, limit = 8, days = 180) => {
    const keys = f ? [f] : FUEL_KEYS, out = [];
    keys.forEach(k => { const s = series(k); for (let i = s.length - 1; i > s.length - days; i--) if (s[i] !== s[i - 1]) out.push({ fuel: k, date: isoDay(s.length - 1 - i), from: s[i - 1], to: s[i], diff: +(s[i] - s[i - 1]).toFixed(2), ago: s.length - 1 - i }); });
    return delay(out.sort((a, b) => a.ago - b.ago).slice(0, limit));
  },
  stations: (city) => {
    const rnd = seeded(city.length * 131 + 7), c = cityByName(city);
    return delay(Array.from({ length: 10 }, (_, i) => {
      const b = BRANDS[Math.floor(rnd() * BRANDS.length)], d = DISTRICTS[(i * 5 + Math.floor(rnd() * 3)) % DISTRICTS.length];
      return { brand: b.n, district: d, km: +(rnd() * 12 + .4).toFixed(1), name: `${b.n} ${d}`, q: `${b.n} ${d} ${c.n}`,
        ...Object.fromEntries(FUEL_KEYS.map(f => [f, +(priceOf(f, city, b.n) + (rnd() - .5) * .12).toFixed(2)])) };
    }).sort((a, b) => a.km - b.km));
  },
};
function lastChangeAge(f) { const s = series(f); let i = s.length - 1; while (i > 0 && s[i] === s[i - 1]) i--; return s.length - 1 - i; }
