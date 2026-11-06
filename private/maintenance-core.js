// Mobile publishing. No plaintext asset or personal metadata leaves this browser.
'use strict';
const MobileAlbum=(()=>{
 const enc=new TextEncoder(),dec=new TextDecoder(),aad=enc.encode('our-days-private-v1');
 const apiRoot='https://api.github.com/repos/zhaoshuai200/our-days-network-test';
 const statePath='private/vault/mobile.bin';
 const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x4000)s+=String.fromCharCode(...bytes.subarray(i,i+0x4000));return btoa(s);}
 const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,'0')).join('');
 async function importKey(s){try{const a=un64(s.trim());if(a.length!==32)throw Error();try{return await crypto.subtle.importKey('raw',a,'AES-GCM',false,['encrypt','decrypt']);}finally{a.fill(0);}}catch{throw Error('相册密钥格式不正确。');}}
 async function seal(data,key){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,data);const out=new Uint8Array(12+cipher.byteLength);out.set(iv);out.set(new Uint8Array(cipher),12);return out;}
 async function openState(data,key){let s;try{s=JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.subarray(0,12),additionalData:aad},key,data.subarray(12))));}catch{throw Error('相册密钥不正确，或维护目录未能通过校验。');}
  if(s.kind!=='mobile-album-v1'||!Array.isArray(s.records)||!Array.isArray(s.applied))throw Error('维护目录版本不匹配。');return s;}
 function github(token,signal){return async(path,method='GET',body)=>{
  const ctrl=new AbortController(),stop=()=>ctrl.abort(),timer=setTimeout(stop,90000);signal?.throwIfAborted();signal?.addEventListener('abort',stop,{once:true});
  try{const res=await fetch(apiRoot+path,{method,signal:ctrl.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
   if(!res.ok){const e=Error(({401:'上传令牌无效或已到期。',403:'GitHub 暂不允许写入，请检查令牌是否有本仓库 Contents 读写权限，或稍后再试。',404:'无法访问相册仓库或维护目录，请核对令牌选中的仓库。',409:'仓库刚刚有更新，请重试。',422:'GitHub 未接受这次更新，请检查是否有同时发布。',429:'请求较多，请稍后再试。'})[res.status]||'GitHub 请求失败（'+res.status+'）。');e.status=res.status;throw e;}
   return await res.json();
  }catch(e){if(e.status||signal?.aborted)throw e;throw Error('手机未能连接 GitHub 上传服务。请检查网络，然后在本页重试。');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
 };}
 async function snapshot(api,key){
  const head=(await api('/git/ref/heads/main')).object.sha;
  const [commit,entry]=await Promise.all([api('/git/commits/'+head),api('/contents/'+statePath+'?ref='+head)]);
  const data=entry.content|| (await api('/git/blobs/'+entry.sha)).content;
  return {head,tree:commit.tree.sha,state:await openState(un64(data),key)};
 }
 async function blob(api,data){return (await api('/git/blobs','POST',{content:b64(data),encoding:'base64'})).sha;}
 async function asset(api,key,data,entries){const file=uid()+'.bin';const sha=await blob(api,await seal(data,key));entries.push({path:'private/vault/'+file,mode:'100644',type:'blob',sha,bytes:data.byteLength+28});return file;}
 async function publish(api,key,change,entries,first){
  for(let n=0;n<3;n++){const {head,tree,state}=n===0&&first?first:await snapshot(api,key);
   if(state.applied.includes(change.id))return head;
   const next=structuredClone(state);
   if(change.record){next.records.push(change.record);Object.assign(next.mediaIndex,change.mediaIndex);Object.assign(next.viewIndex,change.viewIndex);next.chunks.push(...change.chunks);}
   if(Object.hasOwn(change,'music'))next.music=change.music;
   next.applied.push(change.id);
   const sha=await blob(api,await seal(enc.encode(JSON.stringify(next)),key));
   const inventory=await api('/git/trees/'+tree+'?recursive=1');const used=inventory.tree.reduce((sum,x)=>sum+(x.size||0),0);
   if(inventory.truncated||used+entries.reduce((sum,x)=>sum+x.bytes,0)>950000000)throw Error('相册接近当前站点容量上限。请先备份并迁移扩容，本次未发布。');
   const newTree=await api('/git/trees','POST',{base_tree:tree,tree:[...entries.map(({bytes,...entry})=>entry),{path:statePath,mode:'100644',type:'blob',sha}]});
   const commit=await api('/git/commits','POST',{message:'Update encrypted album',tree:newTree.sha,parents:[head]});
   try{await api('/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});return commit.sha;}
   catch(e){if(n===2||![409,422].includes(e.status))throw e;}
  }
 }
 async function variants(file){const url=URL.createObjectURL(file),img=new Image();try{img.src=url;await img.decode();
   const width=img.naturalWidth,height=img.naturalHeight;if(!width||!height||width*height>100e6)throw Error();
   const result={width,height};for(const [name,edge,q]of [['thumb',320,.72],['view',1920,.86],['full',3200,.94]]){
    const canvas=document.createElement('canvas'),scale=Math.min(1,edge/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const b=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',q));if(!b)throw Error();result[name]={mime:b.type,data:new Uint8Array(await b.arrayBuffer())};canvas.width=canvas.height=1;
   }return result;
  }catch{throw Error('这张照片无法读取。请从相册导出为 JPG 或 PNG 后重试。');}finally{img.removeAttribute('src');URL.revokeObjectURL(url);}}
 return {uid,enc,b64,importKey,seal,openState,github,snapshot,asset,publish,variants};
})();
