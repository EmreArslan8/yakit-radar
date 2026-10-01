// Akaryakıt fiyatlarını kaynaklardan çekip data/prices.json'a yazar.  Kullanım: node scripts/fetch-prices.mjs
// Kaynaklar: Opet (API), Petrol Ofisi (HTML), Aytemiz (HTML). Fiyatlar il merkezi / il bazlı pompa fiyatıdır (KDV dahil).
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const UA = { 'User-Agent': 'Mozilla/5.0 (YakitRadar price fetcher)' };
// [site adı, Opet il kodu, PO adı, Aytemiz adı]
const CITIES = [
  ['İstanbul', 934, 'ISTANBUL (AVRUPA)', 'İstanbul'], ['Ankara', 6, 'ANKARA', 'Ankara'], ['İzmir', 35, 'IZMIR', 'İzmir'],
  ['Bursa', 16, 'BURSA', 'Bursa'], ['Antalya', 7, 'ANTALYA', 'Antalya'], ['Adana', 1, 'ADANA', 'Adana'], ['Konya', 42, 'KONYA', 'Konya'],
  ['Gaziantep', 27, 'GAZIANTEP', 'Gaziantep'], ['Kayseri', 38, 'KAYSERI', 'Kayseri'], ['Eskişehir', 26, 'ESKISEHIR', 'Eskişehir'],
  ['Trabzon', 61, 'TRABZON', 'Trabzon'], ['Samsun', 55, 'SAMSUN', 'Samsun'], ['Diyarbakır', 21, 'DIYARBAKIR', 'Diyarbakır'],
  ['Mersin', 33, 'MERSIN', 'Mersin'], ['Muğla', 48, 'MUGLA', 'Muğla'],
];
const get = async (u) => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(u + ' → ' + r.status); return r; };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const tr = (s) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const title = (s) => s.toLocaleLowerCase('tr').replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toLocaleUpperCase('tr'));

async function opet(code) {
  const d = await (await get(`https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=${code}&IncludeAllProducts=true`)).json();
  const pick = (x, c) => x.prices.find((p) => p.productCode === c)?.amount ?? null;
  const rows = d.map((x) => ({ name: title(x.districtName.replace(/_/g, ' ')), benzin: pick(x, 'A100'), motorin: pick(x, 'A128') ?? pick(x, 'A121') })).filter((x) => x.benzin && x.motorin);
  return { brand: { benzin: median(rows.map((r) => r.benzin)), motorin: median(rows.map((r) => r.motorin)) }, districts: rows.sort((a, b) => a.name.localeCompare(b.name, 'tr')) };
}
async function po() {
  const h = await (await get('https://www.petrolofisi.com.tr/akaryakit-fiyatlari')).text(), out = {};
  for (const m of h.matchAll(/<tr class="price-row[^>]*data-disctrict-name="([^"]+)"[\s\S]*?<\/tr>/g)) {
    const v = [...m[0].matchAll(/class="with-tax">([\d.]+)</g)].map((x) => +x[1]);
    out[m[1]] = { benzin: v[0], motorin: v[1], lpg: v[5] ?? null };   // sütunlar: 95, diesel, gazyağı, kalorifer, fuel oil, otogaz
  }
  return out;
}
async function aytemiz() {
  const rows = (h) => [...h.matchAll(/<tr><td[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/td>\s*<td[^>]*>([\d,]+)<\/td>/g), ...h.matchAll(/<tr><td[^>]*>(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<td>([\d,]+)<td>([\d,]+)/g)];
  const b = await (await get('https://www.aytemiz.com.tr/akaryakit-fiyatlari/benzin-fiyatlari')).text();
  const l = await (await get('https://www.aytemiz.com.tr/akaryakit-fiyatlari/lpg-fiyatlari')).text(), out = {}, f = (s) => +s.replace(',', '.');
  for (const m of b.matchAll(/<tr><td[^>]*><a[^>]*>([^<]+)<\/a><td>([\d,]+)<td>([\d,]+)/g)) out[tr(m[1])] = { benzin: f(m[2]), motorin: f(m[3]) };
  for (const m of l.matchAll(/<tr><td[^>]*><a[^>]*>([^<]+)<\/a><\/td><td[^>]*>([\d,]+)<\/td>/g)) (out[tr(m[1])] ??= {}).lpg = f(m[2]);
  return out;
}

const [PO, AY] = await Promise.all([po(), aytemiz()]), cities = {};
for (const [name, code, poName, ayName] of CITIES) {
  const o = await opet(code), brands = { Opet: o.brand, 'Petrol Ofisi': PO[poName] ?? null, Aytemiz: AY[tr(ayName)] ?? null };
  for (const k of Object.keys(brands)) if (!brands[k]) delete brands[k];
  cities[name] = { brands, districts: o.districts };
  console.log(name.padEnd(11), JSON.stringify(brands));
}
const now = new Date().toISOString();
writeFileSync(join(OUT, 'prices.json'), JSON.stringify({ updatedAt: now, sources: ['Opet', 'Petrol Ofisi', 'Aytemiz'], cities }, null, 1));
// günlük anlık görüntü: gerçek geçmiş zamanla buradan birikir
const hp = join(OUT, 'history.json'), hist = existsSync(hp) ? JSON.parse(readFileSync(hp, 'utf8')) : {};
hist[now.slice(0, 10)] = Object.fromEntries(Object.entries(cities).map(([c, v]) => [c, v.brands]));
writeFileSync(hp, JSON.stringify(hist));
console.log('\nOK →', join(OUT, 'prices.json'), now);
