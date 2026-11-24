// Only immutable, encrypted assets are persisted. Never store keys or decoded media.
window.cipherCache=(()=>{
 const name='our-days-cipher-v1',limit=60*1024*1024;let writes=Promise.resolve();
 const valid=file=>/^[a-f0-9]{24}\.bin$/.test(file);
 const address=file=>new URL('vault/'+file,location.href).href;
 async function read(file){if(!valid(file)||!window.caches)return null;try{const c=await caches.open(name),r=await c.match(address(file));return r?new Uint8Array(await r.arrayBuffer()):null;}catch{return null;}}
 function put(file,data){if(!valid(file)||!window.caches||data.byteLength>limit)return;
  writes=writes.catch(()=>{}).then(async()=>{const c=await caches.open(name);await c.put(address(file),new Response(data,{headers:{'Content-Type':'application/octet-stream','X-Cipher-Bytes':String(data.byteLength)}}));
   const keys=await c.keys();let total=0;const sizes=[];for(const key of keys){const r=await c.match(key);const size=Number(r?.headers.get('X-Cipher-Bytes'));if(!size){await c.delete(key);continue;}sizes.push([key,size]);total+=size;}
   for(const [key,size]of sizes){if(total<=limit)break;await c.delete(key);total-=size;}
  }).catch(()=>{});
 }
 async function remove(file){try{if(valid(file)&&window.caches)await(await caches.open(name)).delete(address(file));}catch{}}
 return {read,put,remove};
})();
