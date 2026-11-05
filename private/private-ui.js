document.title='把日子收藏 · 我们的相册';
document.querySelector('.preview-note').textContent='加密相册 · 只读体验 · 原始文件保留在电脑备份中';
document.querySelector('.appearance-note').textContent='外观选择仅在本次打开期间有效';
const privateNote=document.createElement('p');privateNote.className='private-session-note';privateNote.textContent='精选和外观调整仅在本次解锁期间有效。';document.querySelector('.footer').append(privateNote);

// The cover preview opens immediately; fetch its full-quality copy afterward.
if(window.localApp?.hasCover)window.resolvePrivatePhoto('/private-media/home-cover').then(async url=>{
 const decoded=new Image();decoded.src=url;await decoded.decode();
 window.localApp.coverUrl=url;const cover=document.querySelector('.hero-art img');if(cover)cover.src=url;
}).catch(()=>{});

let privateDetailController;
document.querySelector('#detail').addEventListener('close',()=>privateDetailController?.abort());
window.loadPrivateDetail=async(photo,memory,index,quality='view')=>{
 privateDetailController?.abort();const controller=new AbortController();privateDetailController=controller;
 const link=document.querySelector('#detailOriginal');
 const current=()=>!controller.signal.aborted&&activeMemory===memory&&activePhoto===index&&photo.isConnected&&document.querySelector('#detail').open;
 if(quality==='view')photo.src=memory.thumbs[index];link?.removeAttribute('href');
 const label=quality==='full'?'高清大图':'清晰照片';
 if(link){link.textContent='正在加载'+label+'…';link.onclick=event=>event.preventDefault();}
 try{
  const url=await window.resolvePrivatePhoto(memory.photos[index],{quality,priority:1,signal:controller.signal,onProgress:p=>{
   if(!current()||!link)return;
   if(p.phase==='queued'){link.textContent='准备加载'+label+'…';return;}
   if(p.phase==='decrypt'){link.textContent='正在显示'+label+'…';return;}
   const amount=p.total?Math.round(p.loaded/p.total*100)+'%':Math.round(p.loaded/1024)+' KB';
   link.textContent='正在下载'+label+' · '+amount+(p.attempt?' · 重试中':'');
  }});const decoded=new Image();decoded.src=url;await decoded.decode();if(!current())return;
  photo.src=url;
  if(link){
   if(quality==='full'){link.href=url;link.textContent='查看高清照片 ↗';link.onclick=null;}
   else{link.href='#';link.textContent='加载高清大图（3200px）';link.onclick=event=>{event.preventDefault();window.loadPrivateDetail(photo,memory,index,'full');};}
  }
 }catch{
  if(!current())return;
  if(link){link.href='#';link.textContent='连接较慢，点此重试'+label;link.onclick=event=>{event.preventDefault();window.loadPrivateDetail(photo,memory,index,quality);};}
 }
};
// Only visible album cards request clear images; small thumbnail strips stay small.
(()=>{
 const observed=new WeakSet(),queue=[];let running=0;
 function pump(){while(running<1&&queue.length){const {img,route}=queue.shift();if(!img.isConnected)continue;running++;
  window.resolvePrivatePhoto(route).then(async url=>{const decoded=new Image();decoded.src=url;await decoded.decode();if(img.isConnected)img.src=url;}).catch(()=>{}).finally(()=>{running--;pump();});
 }}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);const img=entry.target,memory=window.localMemories.find(m=>String(m.id)===img.closest('[data-id]')?.dataset.id);if(memory)queue.push({img,route:memory.photos[memory.cover||0]});}pump();},{rootMargin:'100px'});
 function scan(){document.querySelectorAll('.card-art img').forEach(img=>{if(!observed.has(img)){observed.add(img);observer.observe(img);}});}
 for(const id of ['timeline','placeCards'])new MutationObserver(scan).observe(document.getElementById(id),{childList:true,subtree:true});scan();
})();
