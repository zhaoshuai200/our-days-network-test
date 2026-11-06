(()=>{
 const $=id=>document.getElementById(id),urls=new Set(),aad=new TextEncoder().encode('our-days-private-v1');
 let generation=0,controller,retryKey=null;
 const revision='mobile5';
 function bytes(text){return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
 function status(text,current){if(current===generation)$('status').textContent=text;}
 // Bound both idle connections and total transfer time. Locking cancels retries too.
 async function download(url,signal,report=()=>{},limits={}){
  for(let attempt=0;attempt<(limits.attempts||3);attempt++){
   signal.throwIfAborted();const request=new AbortController();let idle,total,timedOut=false;
   const abort=()=>request.abort(signal.reason),expire=()=>{timedOut=true;request.abort();};
   const touch=()=>{clearTimeout(idle);idle=setTimeout(expire,limits.idle||15000);};
   signal.addEventListener('abort',abort,{once:true});total=setTimeout(expire,limits.total||60000);touch();
   try{
    report({attempt,loaded:0,total:0});
    const response=await fetch(url,{signal:request.signal});if(!response.ok)throw new Error('NETWORK');touch();
    const size=Number(response.headers.get('content-length'))||0;
    if(!response.body){const data=new Uint8Array(await response.arrayBuffer());report({attempt,loaded:data.length,total:size});return data;}
    const reader=response.body.getReader(),parts=[];let loaded=0;
    while(true){const {done,value}=await reader.read();if(done)break;parts.push(value);loaded+=value.length;touch();report({attempt,loaded,total:size});}
    const data=new Uint8Array(loaded);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}return data;
   }catch(error){
    if(signal.aborted)throw signal.reason;
    if(attempt===(limits.attempts||3)-1)throw new Error(timedOut?'TIMEOUT':'NETWORK');
   }finally{clearTimeout(idle);clearTimeout(total);signal.removeEventListener('abort',abort);request.abort();}
  }
 }
 async function decryptBytes(file,key,signal,report,limits){
  const data=await download('vault/'+file+(file==='mobile.bin'?'?t='+Date.now():file==='manifest.bin'?'?v='+revision:''),signal,report,limits);
  signal.throwIfAborted();report?.({phase:'decrypt'});return crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:aad},key,data.slice(12));
 }
 async function decrypt(file,key,signal,report){return JSON.parse(new TextDecoder().decode(await decryptBytes(file,key,signal,report)));}
 function clearMedia(){delete window.privatePhoto;for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
 function lock(){++generation;controller?.abort();retryKey=null;clearMedia();$('viewer').hidden=true;$('viewer').removeAttribute('srcdoc');$('session').hidden=true;$('entry').hidden=false;$('accessKey').value='';$('accessKey').required=true;$('progress').hidden=true;$('cancel').hidden=true;$('unlock').disabled=false;$('unlock').textContent='打开相册';$('status').textContent='';}
 $('lock').onclick=lock;$('cancel').onclick=()=>{lock();$('status').textContent='已取消，可以重新打开相册。';};
 $('accessKey').addEventListener('input',()=>{retryKey=null;$('accessKey').required=true;$('unlock').textContent='打开相册';});
 window.addEventListener('pagehide',lock);window.addEventListener('pageshow',e=>{if(e.persisted)lock();});
 $('unlockForm').onsubmit=async event=>{
  event.preventDefault();const current=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal;
  $('unlock').disabled=true;$('cancel').hidden=false;$('progress').hidden=true;
  try{
   if(!crypto.subtle)throw new Error('UNSUPPORTED');let key=retryKey;
   if(!key){let raw;try{raw=bytes($('accessKey').value.trim());}catch{throw new Error('KEY');}if(raw.length!==32)throw new Error('KEY');key=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']);raw.fill(0);}
   status('正在下载相册目录…',current);
   const manifest=await decrypt('manifest.bin',key,signal,p=>status(p.attempt?`目录连接重试 ${p.attempt} / 2…`:'正在下载相册目录…',current));
   if(current!==generation)return;if(manifest.version!==1)throw new Error('VERSION');
   // Retain a verified key only in memory for manual network retries.
   retryKey=key;$('accessKey').value='';$('accessKey').required=false;
   status('正在同步手机发布的回忆…',current);
   const updates=await decrypt('mobile.bin',key,signal);if(current!==generation)return;
   if(updates.kind!=='mobile-album-v1')throw new Error('VERSION');
   manifest.records.push(...updates.records);manifest.chunks.push(...updates.chunks);Object.assign(manifest.mediaIndex,updates.mediaIndex);Object.assign(manifest.viewIndex,updates.viewIndex);
   if(updates.music)manifest.mediaIndex['/mobile/music']=updates.music;
   const media={};$('progress').hidden=false;$('progress').max=manifest.chunks.length;
   for(let i=0;i<manifest.chunks.length;i++){
    const chunk=await decrypt(manifest.chunks[i],key,signal,p=>{
     if(p.phase==='decrypt')return;const amount=p.total?`${Math.round(p.loaded/1024)} / ${Math.round(p.total/1024)} KB`:`${Math.round(p.loaded/1024)} KB`;
     status(`正在下载预览 ${i+1} / ${manifest.chunks.length} · ${amount}${p.attempt?' · 重试 '+p.attempt+' / 2':''}`,current);
     if(current===generation)$('progress').value=i+(p.total?p.loaded/p.total:0);
    });if(current!==generation)return;
    status(`正在整理预览 ${i+1} / ${manifest.chunks.length}…`,current);
    for(const [route,item]of Object.entries(chunk)){const url=URL.createObjectURL(new Blob([bytes(item.data)],{type:item.mime}));urls.add(url);media[route]=url;}
    $('progress').value=i+1;
   }
   const requestPhoto=window.createPhotoRequests({signal,load:async(id,photoSignal,onProgress)=>{
    const separator=id.indexOf('|'),quality=id.slice(0,separator),route=id.slice(separator+1);
    const asset=(quality==='full'?manifest.mediaIndex:manifest.viewIndex||manifest.mediaIndex)[route];
    if(!asset){if(media[route])return media[route];throw new Error('Missing image');}
    const data=await decryptBytes(asset.file,key,photoSignal,onProgress,route==='/mobile/music'?{idle:15000,total:90000,attempts:2}:{idle:10000,total:25000,attempts:2});
    if(current!==generation||photoSignal.aborted)throw new DOMException('Cancelled','AbortError');
    const url=URL.createObjectURL(new Blob([data],{type:asset.mime}));urls.add(url);return url;
   }});
   window.privatePhoto=(route,options={})=>requestPhoto((options.quality==='full'?'full':'view')+'|'+route,options);
   const records=manifest.records.map(m=>({...m,thumbs:m.thumbs.map(u=>media[u])}));if(records.some(m=>m.thumbs.some(u=>!u)))throw new Error('MISSING');
   const app={music:updates.music||null,settings:manifest.settings,hasCover:manifest.hasCover,coverUrl:media['/private-media/home-cover']};
   status('正在打开相册…',current);let html=new TextDecoder().decode(await download('private-app.html?v='+revision,signal));if(current!==generation)return;
   const safe=value=>JSON.stringify(value).replaceAll('<','\\u003c');
   html=html.replace('<head>','<head><base href="'+new URL('./',location.href).href+'">').replace('<!--PRIVATE_STATE-->',()=>'<script>window.localMemories='+safe(records)+';window.localApp='+safe(app)+';window.resolvePrivatePhoto=parent.privatePhoto;window.privatePreferences={store:new Map(),getItem(k){return this.store.get(k)||null},setItem(k,v){this.store.set(k,v)}};<\/script>');
   $('viewer').srcdoc=html;$('viewer').hidden=false;$('session').hidden=false;$('entry').hidden=true;retryKey=null;
  }catch(e){
   if(current!==generation)return;clearMedia();
   const network=['NETWORK','TIMEOUT'].includes(e.message);
   if(!network){retryKey=null;$('accessKey').required=true;}
   status(e.message==='UNSUPPORTED'?'当前浏览器不支持安全解密，请用最新版 Safari 或手机浏览器打开。':network?'照片下载中断，已自动重试两次。请检查网络，再点“重试打开”。':'密钥不正确或加密数据校验失败，请检查后重试。',current);
   $('unlock').textContent=network?'重试打开':'打开相册';$('progress').hidden=true;
  }finally{if(current===generation){$('unlock').disabled=false;$('cancel').hidden=true;}}
 };
})();
