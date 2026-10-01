// İstemci tarafı durum (localStorage). Gerçek sistemde: oturum + DB'ye taşınır.
const Store = {
  get(k, d) { try { const v = localStorage.getItem('yr:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('yr:' + k, JSON.stringify(v)); } catch {} },
  get city() { return this.get('city', 'İstanbul'); },
  setCity(c) { this.set('city', c); window.dispatchEvent(new Event('citychange')); },
};

// Mock üyelik. Gerçekte parola sunucuda hash'lenir; burada sadece arayüz akışı için.
const Auth = {
  _seed() {
    if (Store.get('users', null)) return;
    Store.set('users', [
      { id: 1, name: 'Admin', email: 'admin@yakitradar.com', pass: 'admin123', role: 'admin', created: '2026-01-04' },
      { id: 2, name: 'Demo Kullanıcı', email: 'demo@yakitradar.com', pass: 'demo123', role: 'user', created: '2026-03-18' },
    ]);
  },
  users() { this._seed(); return Store.get('users', []); },
  current() { return Store.get('session', null); },
  login(email, pass) {
    const u = this.users().find(x => x.email === email.trim().toLowerCase() && x.pass === pass);
    if (!u) return { error: 'E-posta veya parola hatalı.' };
    Store.set('session', { id: u.id, name: u.name, email: u.email, role: u.role });
    return { user: u };
  },
  register(name, email, pass) {
    email = email.trim().toLowerCase();
    if (name.trim().length < 2) return { error: 'Ad en az 2 karakter olmalı.' };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Geçerli bir e-posta girin.' };
    if (pass.length < 6) return { error: 'Parola en az 6 karakter olmalı.' };
    const users = this.users();
    if (users.some(u => u.email === email)) return { error: 'Bu e-posta zaten kayıtlı.' };
    const u = { id: Date.now(), name: name.trim(), email, pass, role: 'user', created: new Date().toISOString().slice(0, 10) };
    Store.set('users', [...users, u]);
    return this.login(email, pass);
  },
  logout() { localStorage.removeItem('yr:session'); },
  require(role) {
    const u = this.current();
    if (!u || (role && u.role !== role)) { location.href = 'giris.html?next=' + encodeURIComponent(location.pathname.split('/').pop()); return null; }
    return u;
  },
};
