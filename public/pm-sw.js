// Shell offline de emergência. Não armazenar APIs do Supabase no Cache Storage.
const CACHE='pm-cerimonial-emergencia-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.add('/').catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{
 const req=e.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'){
   e.respondWith(fetch(req).then(res=>{if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put('/',clone));}return res;}).catch(()=>caches.match('/') ));return;
 }
 if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/static/')){
   e.respondWith(caches.match(req).then(old=>old||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;})));
 }
});
