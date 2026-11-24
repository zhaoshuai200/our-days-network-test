// Commit the selected photo and its metadata together, only after decode succeeds.
const readyViews=new Map();
async function prepareView(route,options={}){
 options.signal?.throwIfAborted();if(readyViews.has(route))return readyViews.get(route);
 const url=await window.resolvePrivatePhoto(route,options),image=new Image();image.src=url;await image.decode();
 options.signal?.throwIfAborted();readyViews.set(route,url);return url;
}
window.privateReadyView=route=>readyViews.get(route);
let galleryRequest=null,galleryVersion=0,neighborController;
window.privateReading=()=>Boolean(galleryRequest||document.querySelector('#detail').open);
function galleryIdle(){document.dispatchEvent(new Event('private-gallery-idle'));}
function cancelGallery(){galleryVersion++;galleryRequest?.controller.abort();galleryRequest?.notice?.remove();galleryRequest=null;galleryIdle();}
function warmNeighbors(memory,index){
 neighborController?.abort();neighborController=new AbortController();if(navigator.connection?.saveData)return;
 const signal=neighborController.signal;
 // Sequential work stays within this memory and leaves a foreground slot free.
 const order=[];for(let step=1;step<memory.photos.length;step++){if(index+step<memory.photos.length)order.push(index+step);if(index-step>=0)order.push(index-step);}
 (async()=>{for(const i of order){signal.throwIfAborted();try{await prepareView(memory.photos[i],{signal});}catch(e){if(signal.aborted)throw e;}}})().catch(()=>{});
}
function requestGallery(memory,index,opening){
 cancelGallery();
 const version=galleryVersion,controller=new AbortController(),route=memory.photos[index];
 const valid=()=>version===galleryVersion&&!controller.signal.aborted&&(opening||document.querySelector('#detail').open&&activeMemory===memory);
 function commit(){if(!valid())return;galleryRequest?.notice?.remove();galleryRequest=null;
  if(opening)renderPrivateDetail(memory.id);else renderPrivatePhoto(index);
  warmNeighbors(memory,index);
 }
 galleryRequest={controller,notice:null};
 if(!route||readyViews.has(route)){document.dispatchEvent(new Event('private-gallery-busy'));commit();return;}
 const notice=document.createElement('div');notice.className='private-photo-wait';
 notice.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:9999;width:min(92vw,430px);box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:12px;border:1px solid #b7c8d2;border-radius:14px;background:#fffdf7;color:#304b62;box-shadow:0 4px 24px #243c5620;font:14px/1.5 system-ui';
 const label=document.createElement('span');label.setAttribute('role','status');label.style.flex='1';
 const retry=document.createElement('button');retry.type='button';retry.textContent='重试';retry.hidden=true;
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='取消';cancel.onclick=cancelGallery;
 for(const button of [retry,cancel])button.style.cssText='font:inherit;color:inherit;background:transparent;border:0;padding:8px;cursor:pointer';
 notice.append(label,retry,cancel);(opening?document.body:document.querySelector('#detail')).append(notice);galleryRequest.notice=notice;
 const prefix=opening?'正在准备清晰照片':'正在准备第 '+(index+1)+' 张';label.textContent=prefix+'…';
 retry.onclick=()=>requestGallery(memory,index,opening);
 const loading=prepareView(route,{priority:2,signal:controller.signal,onProgress:p=>{if(!valid())return;label.textContent=prefix+(p.total?' · '+Math.round(p.loaded/p.total*100)+'%':'…');}});document.dispatchEvent(new Event('private-gallery-busy'));neighborController?.abort();loading.then(commit).catch(()=>{
  if(!valid())return;label.textContent='暂时没加载好，可以重试或取消。';retry.hidden=false;
 });
}
window.requestPrivateMemory=id=>{const m=memories.find(m=>String(m.id)===String(id));if(m)requestGallery(m,m.cover||0,true);};
window.requestPrivatePhoto=index=>{if(activeMemory?.photos.length)requestGallery(activeMemory,Math.max(0,Math.min(index,activeMemory.photos.length-1)),false);};
document.querySelector('#detail').addEventListener('close',()=>{neighborController?.abort();cancelGallery();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&galleryRequest)cancelGallery();});
window.addEventListener('pagehide',()=>{neighborController?.abort();cancelGallery();});
