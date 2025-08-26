const VERSION='pw-v1.0.0';
const ASSETS=[
  './','./index.html','./styles.css','./manifest.webmanifest',
  './js/app.js','./js/db.js','./js/ui.js',
  './icons/icon-192.png','./icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSION);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for (const key of await caches.keys()) if (key!==VERSION) await caches.delete(key);
    self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if (req.method!=='GET') return;
  if (req.headers.get('accept')?.includes('text/html')){
    e.respondWith((async()=>{
      try{
        const r=await fetch(req);
        const c=await caches.open(VERSION); c.put(req, r.clone());
        return r;
      }catch{
        const c=await caches.open(VERSION);
        return (await c.match(req)) || (await c.match('./index.html'));
      }
    })());
  }else{
    e.respondWith((async()=>{
      const c=await caches.open(VERSION);
      const m=await c.match(req); if (m) return m;
      try{
        const r=await fetch(req); c.put(req,r.clone()); return r;
      }catch{ return new Response('',{status:504}); }
    })());
  }
});
