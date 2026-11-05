document.title='把日子收藏 · 我们的相册';
document.querySelector('.preview-note').textContent='加密相册 · 只读体验 · 原始文件保留在电脑备份中';
document.querySelector('.appearance-note').textContent='外观选择仅在本次打开期间有效';
const privateNote=document.createElement('p');privateNote.className='private-session-note';privateNote.textContent='精选和外观调整仅在本次解锁期间有效。';document.querySelector('.footer').append(privateNote);

window.loadPrivateDetail=async(photo,memory,index)=>{
 const link=document.querySelector('#detailOriginal');
 photo.src=memory.thumbs[index];link?.removeAttribute('href');
 if(link){link.textContent='正在加载高清照片…';link.onclick=event=>event.preventDefault();}
 try{
  const url=await window.resolvePrivatePhoto(memory.photos[index]);const decoded=new Image();decoded.src=url;await decoded.decode();
  if(activeMemory!==memory||activePhoto!==index||!photo.isConnected||!document.querySelector('#detail').open)return;
  photo.src=url;if(link){link.href=url;link.textContent='查看清晰照片 ↗';link.onclick=null;}
 }catch{
  if(activeMemory!==memory||activePhoto!==index||!photo.isConnected)return;
  if(link){link.href='#';link.textContent='高清加载未完成，点此重试';link.onclick=event=>{event.preventDefault();window.loadPrivateDetail(photo,memory,index);};}
 }
};
// Only visible album cards request clear images; small thumbnail strips stay small.
(()=>{
 const observed=new WeakSet(),queue=[];let running=0;
 function pump(){while(running<2&&queue.length){const {img,route}=queue.shift();if(!img.isConnected)continue;running++;
  window.resolvePrivatePhoto(route).then(async url=>{const decoded=new Image();decoded.src=url;await decoded.decode();if(img.isConnected)img.src=url;}).catch(()=>{}).finally(()=>{running--;pump();});
 }}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);const img=entry.target,memory=window.localMemories.find(m=>String(m.id)===img.closest('[data-id]')?.dataset.id);if(memory)queue.push({img,route:memory.photos[memory.cover||0]});}pump();},{rootMargin:'100px'});
 function scan(){document.querySelectorAll('.card-art img').forEach(img=>{if(!observed.has(img)){observed.add(img);observer.observe(img);}});}
 for(const id of ['timeline','placeCards'])new MutationObserver(scan).observe(document.getElementById(id),{childList:true,subtree:true});scan();
})();
