(()=>{
 const $=id=>document.getElementById(id),urls=new Set(),aad=new TextEncoder().encode('our-days-private-v1');let generation=0,controller;
 function bytes(text){return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
 async function decryptBytes(file,key,signal){const response=await fetch('vault/'+file,{signal});if(!response.ok)throw new Error('NETWORK');const data=new Uint8Array(await response.arrayBuffer());return crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:aad},key,data.slice(12));}
 async function decrypt(file,key,signal){return JSON.parse(new TextDecoder().decode(await decryptBytes(file,key,signal)));}
 function lock(){++generation;controller?.abort();delete window.privatePhoto;$('viewer').hidden=true;$('viewer').removeAttribute('srcdoc');for(const url of urls)URL.revokeObjectURL(url);urls.clear();$('session').hidden=true;$('entry').hidden=false;$('accessKey').value='';$('progress').hidden=true;$('unlock').disabled=false;$('status').textContent='';}
 $('lock').onclick=lock;window.addEventListener('pagehide',lock);window.addEventListener('pageshow',e=>{if(e.persisted)lock();});
 $('unlockForm').onsubmit=async event=>{
  event.preventDefault();const current=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal;
  $('unlock').disabled=true;$('status').textContent='正在解锁…';$('progress').hidden=true;
  try{
   if(!crypto.subtle)throw new Error('UNSUPPORTED');const raw=bytes($('accessKey').value.trim());if(raw.length!==32)throw new Error('KEY');
   let key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);raw.fill(0);$('accessKey').value='';
   const manifest=await decrypt('manifest.bin',key,signal);if(manifest.version!==1)throw new Error('VERSION');
   const media={};$('progress').hidden=false;$('progress').max=manifest.chunks.length;
   for(let i=0;i<manifest.chunks.length;i++){
    if(current!==generation)return;$('status').textContent=`正在解密照片 ${i+1} / ${manifest.chunks.length}…`;
    const chunk=await decrypt(manifest.chunks[i],key,signal);if(current!==generation)return;
    for(const [route,item]of Object.entries(chunk)){const url=URL.createObjectURL(new Blob([bytes(item.data)],{type:item.mime}));urls.add(url);media[route]=url;}
    $('progress').value=i+1;
   }
   const pending=new Map();window.privatePhoto=route=>{
    if(current!==generation)return Promise.reject(new Error('Locked'));if(media[route])return Promise.resolve(media[route]);if(pending.has(route))return pending.get(route);
    const asset=manifest.mediaIndex[route];if(!asset)return Promise.reject(new Error('Missing image'));
    const promise=decryptBytes(asset.file,key,signal).then(data=>{if(current!==generation)throw new Error('Locked');const url=URL.createObjectURL(new Blob([data],{type:asset.mime}));urls.add(url);media[route]=url;return url;}).finally(()=>pending.delete(route));pending.set(route,promise);return promise;
   };
   const records=manifest.records.map(m=>({...m,thumbs:m.thumbs.map(u=>media[u])}));
   if(records.some(m=>m.thumbs.some(u=>!u)))throw new Error('MISSING');
   const app={settings:manifest.settings,hasCover:manifest.hasCover,coverUrl:media['/private-media/home-cover']};
   const response=await fetch('private-app.html',{signal});if(!response.ok)throw new Error('NETWORK');let html=await response.text();if(current!==generation)return;
   const safe=value=>JSON.stringify(value).replaceAll('<','\\u003c');
   html=html.replace('<head>','<head><base href="'+new URL('./',location.href).href+'">').replace('<!--PRIVATE_STATE-->','<script>window.localMemories='+safe(records)+';window.localApp='+safe(app)+';window.resolvePrivatePhoto=parent.privatePhoto;window.privatePreferences={store:new Map(),getItem(k){return this.store.get(k)||null},setItem(k,v){this.store.set(k,v)}};<\/script>');
   $('viewer').srcdoc=html;$('viewer').hidden=false;$('session').hidden=false;$('entry').hidden=true;
  }catch(e){if(current!==generation)return;delete window.privatePhoto;for(const url of urls)URL.revokeObjectURL(url);urls.clear();$('status').textContent=e.message==='UNSUPPORTED'?'当前浏览器不支持安全解密，请用最新版 Safari 或手机浏览器打开。':e.message==='NETWORK'||e.name==='TypeError'?'网络加载未完成，请重新输入密钥再试。':'密钥不正确或加密数据校验失败，请检查后重试。';$('progress').hidden=true;}
  finally{if(current===generation)$('unlock').disabled=false;}
 };
})();

