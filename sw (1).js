/* ErfoNT pro — Service Worker: شل برنامه + کتابخانه‌های CDN برای کار آفلاین واقعی */
const VERSION = 'erfont-11.4.0';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const CDN = ["https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"];
const HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/* ثبت رویدادهای مهم برای گزارش تشخیصی (کش جدا؛ با به‌روزرسانی پاک نمی‌شود) */
async function note(o) { try { const c = await caches.open('spxlog'), old = await c.match('nav-log'), arr = old ? await old.json() : []; arr.push(Object.assign({ t: Date.now() }, o)); await c.put('nav-log', new Response(JSON.stringify(arr.slice(-30)))); } catch (e) {} }

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all([c.addAll(SHELL), c.add(new Request('config.js')).catch(() => {}), ...CDN.map(u => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {}))])));
});

/* به‌روزرسانی امن: نسخه‌ی جدید منتظر می‌ماند تا کاربر تأیید کند؛ وسط کار هیچ‌چیز عوض نمی‌شود */
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter(k => k.startsWith('erfont-') && k !== VERSION);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) {
    if (!HOSTS.includes(url.hostname)) return; // Firebase و سرویس‌های دیگر مستقیم از شبکه
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })));
    return;
  }
  if (req.mode === 'navigate') {
    /* همیشه index.html تمیز را از سرور می‌خواهیم (آدرس بلند/پارامتر اضافه هرگز به سرور نمی‌رسد → خطای ۴۱۴ ممکن نیست)
       و اگر پاسخ خطا بود یا اینترنت قطع بود، نسخه‌ی ذخیره‌شده نمایش داده می‌شود، نه صفحه‌ی خطا. */
    const clean = new URL('index.html', self.registration.scope).href;
    e.respondWith((async () => {
      try {
        const r = await fetch(clean, { cache: 'no-cache' });
        if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); return r; }
      } catch (err) {}
      return (await caches.match('index.html')) || (await caches.match('./')) || Response.error();
    })());
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
