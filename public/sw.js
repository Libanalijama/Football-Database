const CACHE='tgiq-prepared-media-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||!['image','font'].includes(req.destination))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const existing=await cache.match(req);if(existing)return existing;
  const response=await fetch(req);if(response.ok||response.type==='opaque'){await cache.put(req,response.clone());const keys=await cache.keys();if(keys.length>350)await cache.delete(keys[0]);}return response;
 }));
});
