// Ortak arayüz: kabuk (nav/footer), yardımcılar, animasyonlar
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const icons = () => window.lucide && lucide.createIcons();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const NAV = [
  ['index.html', 'Fiyatlar', 'fuel'], ['karsilastirma.html', 'Karşılaştır', 'scale'],
  ['gecmis.html', 'Geçmiş & Tahmin', 'line-chart'], ['asistan.html', 'AI Asistan', 'sparkles'],
];

function renderShell() {
  const cur = location.pathname.split('/').pop() || 'index.html', u = Auth.current();
  const acct = u ? (u.role === 'admin' ? 'admin.html' : 'panel.html') : 'giris.html';
  $('#nav').innerHTML = `
  <header class="nav"><div class="wrap nav-in">
    <a class="logo" href="index.html"><span class="logo-mark"><i data-lucide="gauge" class="i"></i></span>YakıtRadar</a>
    <nav class="links">${NAV.map(([h, t]) => `<a href="${h}" class="${h === cur ? 'active' : ''}">${t}</a>`).join('')}</nav>
    <div class="nav-r">
      <label class="citypick" style="margin:0"><i data-lucide="map-pin" class="i"></i>
        <select id="citySel" aria-label="Şehir">${CITIES.map(c => `<option ${c.n === Store.city ? 'selected' : ''}>${c.n}</option>`).join('')}</select></label>
      ${u ? `<a class="btn ghost sm hide-m" href="${acct}">${u.role === 'admin' ? 'Admin' : 'Panelim'}</a><a class="avatar" href="${acct}" title="${esc(u.name)}">${esc(u.name[0].toUpperCase())}</a>`
          : `<a class="btn sm" href="giris.html"><i data-lucide="log-in" class="i"></i>Giriş</a>`}
    </div></div></header>
  <nav class="tabbar">${[...NAV.slice(0, 4), [acct, u ? 'Panel' : 'Giriş', u ? 'layout-dashboard' : 'user']].map(([h, t, ic]) =>
    `<a href="${h}" class="${h === cur ? 'active' : ''}"><i data-lucide="${ic}" class="i"></i>${t.split(' ')[0]}</a>`).join('')}</nav>`;
  $('#foot').innerHTML = `
  <footer class="foot"><div class="wrap">
    <div class="foot-g">
      <div><a class="logo" href="index.html" style="margin-bottom:14px"><span class="logo-mark"><i data-lucide="gauge" class="i"></i></span>YakıtRadar</a>
        <p style="max-width:300px">Türkiye'nin akaryakıt fiyatlarını şehir ve istasyon bazında izle, karşılaştır, tahmin et.</p></div>
      <div><h4>Sayfalar</h4>${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</div>
      <div><h4>Şehirler</h4>${CITIES.slice(0, 5).map(c => `<a href="sehir.html?s=${c.s}">${c.n} akaryakıt fiyatları</a>`).join('')}</div>
      <div><h4>Hesap</h4><a href="giris.html">Giriş / Kayıt</a><a href="panel.html">Kullanıcı paneli</a><a href="admin.html">Admin</a></div>
    </div>
    <div class="foot-b"><span>© 2026 YakıtRadar</span><span>Fiyatlar bilgilendirme amaçlıdır; istasyonda farklılık gösterebilir.</span></div>
  </div></footer><div class="toast" id="toast"></div>`;
  $('#citySel').onchange = e => Store.setCity(e.target.value);
  window.addEventListener('citychange', () => { const s = $('#citySel'); if (s) s.value = Store.city; });
  icons(); reveal();
}
document.addEventListener('DOMContentLoaded', renderShell);

function reveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 });
  $$('.rv:not(.in)').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
}
function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }

function deltaHTML(diff) {
  if (diff == null) return '';
  if (Math.abs(diff) < .005) return `<span class="delta flat"><i data-lucide="minus" class="i"></i>0,00</span>`;
  return `<span class="delta ${diff > 0 ? 'up' : 'down'}"><i data-lucide="${diff > 0 ? 'arrow-up-right' : 'arrow-down-right'}" class="i"></i>${diff > 0 ? '+' : ''}${num(diff)}</span>`;
}
function spark(values, color, w = 300, h = 56) {
  const min = Math.min(...values), max = Math.max(...values), r = max - min || 1;
  const pts = values.map((v, i) => [i / (values.length - 1) * w, h - 4 - (v - min) / r * (h - 10)]);
  const d = pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${w} ${h} L0 ${h}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function countUp(el, to, dur = 900) {
  const t0 = performance.now(), from = +el.dataset.v || to * .96;
  const step = t => { const k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = (el.dataset.dot ? num(from + (to - from) * e).replace(",", ".") : num(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); else el.dataset.v = to; };
  requestAnimationFrame(step);
}
const fuelChips = (sel, id = 'fuelChips') => `<div class="chips" id="${id}">${FUEL_KEYS.map(k => `<button class="chip ${k === sel ? 'on' : ''}" data-f="${k}" style="--c:${FUELS[k].color}"><span class="dot"></span>${FUELS[k].short}</button>`).join('')}</div>`;
function bindChips(id, cb) {
  const box = $('#' + id); if (!box) return;
  box.onclick = e => { const b = e.target.closest('.chip'); if (!b) return; $$('.chip', box).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.f ?? b.dataset.v); };
}
const fmtDate = iso => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
