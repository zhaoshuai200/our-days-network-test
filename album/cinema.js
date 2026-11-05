// Keep each memory's photographs together, ordered from the earliest day onward.
function buildCinemaPlaylist(records,source='all'){
 return records.filter(m=>source==='all'||m.persisted).slice().sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)))
  .flatMap(memory=>memory.photos.map((src,photoIndex)=>({src,thumb:memory.thumbs?.[photoIndex]||src,original:memory.originals?.[photoIndex]||src,memory,photoIndex})).filter(item=>source==='all'||!Array.isArray(memory.cinemaPicks)||memory.cinemaPicks.includes(item.src))).filter(item=>typeof item.src==='string'&&item.src.length>0);
}
function advanceCinemaOrbit(base,progress,delta,count,total){
 const next=progress+delta*count/90000,steps=Math.floor(next);
 return {base:(base+steps)%total,progress:next-steps,changed:steps>0};
}
function cinemaStartIndex(playlist,bookmark,random=Math.random){
 if(!playlist.length)return -1;
 const saved=playlist.findIndex(item=>(String(item.memory.id)===bookmark?.memoryId||item.memory.sourceBatches?.some(b=>b.id===bookmark?.memoryId))&&item.src===bookmark?.src);
 return saved>=0?saved:Math.floor(random()*playlist.length);
}
function balancedPhotoSize(ratio,width,height){
 const w=Math.min(width*.94,1040),h=height*.98;
 const area=Math.min(w*w/1.6,h*h/1.5);
 const photoWidth=Math.min(w,h*ratio,Math.sqrt(area*ratio));
 return {width:photoWidth,height:photoWidth/ratio};
}
(()=>{
 const dialog=document.querySelector('#cinema'),stage=document.querySelector('#cinemaStage'),ring=document.querySelector('#cinemaRing');
 const focus=document.querySelector('#cinemaFocus'),focusImage=document.querySelector('#cinemaPhoto'),pause=document.querySelector('#cinemaPause');
 const lightbox=document.querySelector('#cinemaLightbox'),zoomImage=document.querySelector('#cinemaZoomPhoto');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width: 680px)');
 const duration=3000;
 const bookmarkKey='our-little-days.github-album-test.cinema-position.v1';
 let bookmark=null,currentSource='all';
 try{bookmark=JSON.parse(localStorage.getItem(bookmarkKey));}catch{}
 function savePosition(){
  const item=playlist[index];if(!item)return;
  const next={memoryId:String(item.memory.id),src:item.src,source:currentSource};
  if(bookmark?.memoryId===next.memoryId&&bookmark?.src===next.src&&bookmark?.source===next.source)return;
  bookmark=next;
  try{localStorage.setItem(bookmarkKey,JSON.stringify(bookmark));}catch{}
 }
 const marker=document.createElement('div');marker.className='cinema-marker';marker.setAttribute('aria-hidden','true');
 let playlist=[],index=0,playing=false,elapsed=0,orbitBase=0,orbitProgress=0,frame=0,lastTime=0,clockTimer=0,tiles=[],size={width:0,height:0};
 const wrap=n=>(n%playlist.length+playlist.length)%playlist.length;
 let photoRequest=0,oldPhoto=null;
 function clearPhotoTransition(){
  focusImage.getAnimations().forEach(a=>a.cancel());
  oldPhoto?.remove();oldPhoto=null;
 }
 async function presentPhoto(item,animate){
  const request=++photoRequest,loader=new Image();
  focus.setAttribute('aria-busy','true');focus.disabled=true;
  try{
   loader.src=item.src;await loader.decode();
   if(request!==photoRequest||!dialog.open)return;
   clearPhotoTransition();
   if(animate&&!reduced.matches&&focusImage.naturalWidth){
    oldPhoto=focusImage.cloneNode();oldPhoto.removeAttribute('id');oldPhoto.alt='';oldPhoto.setAttribute('aria-hidden','true');oldPhoto.className='cinema-outgoing';focus.prepend(oldPhoto);
   }
   focusImage.src=item.src;sizePhoto();
   if(oldPhoto){
    const outgoing=oldPhoto;
    outgoing.animate([{opacity:1},{opacity:0}],{duration:480,easing:'ease-in-out',fill:'forwards'}).finished.then(()=>{outgoing.remove();if(oldPhoto===outgoing)oldPhoto=null;}).catch(()=>{});
    focusImage.animate([{opacity:0},{opacity:1}],{duration:480,easing:'ease-in-out'});
   }
   focus.disabled=false;focus.removeAttribute('aria-busy');
  }catch{
   if(request!==photoRequest||!dialog.open)return;
   clearPhotoTransition();focusImage.removeAttribute('src');focus.removeAttribute('aria-busy');
   document.querySelector('#cinemaImageError').hidden=false;
  }
 }
 function updateClock(){
  const t=relationshipElapsed(relationshipMoment(coverSettings.date,coverSettings.time),Date.now());
  document.querySelector('#cinemaDays').textContent=t.days.toLocaleString('en-US');
  document.querySelector('#cinemaClock').textContent=[t.hours,t.minutes,t.seconds].map(n=>String(n).padStart(2,'0')).join(' : ');
 }
 function sizePhoto(){
  const ratio=focusImage.naturalWidth/focusImage.naturalHeight;if(!Number.isFinite(ratio)||ratio<=0)return;
  const dimensions=balancedPhotoSize(ratio,size.width,size.height);
  focusImage.style.width=`${dimensions.width}px`;focusImage.style.height=`${dimensions.height}px`;
  layout();
 }
 focusImage.addEventListener('load',sizePhoto);
 function measure(){size={width:stage.clientWidth,height:stage.clientHeight};sizePhoto();layout();}
 function layout(){
  const count=tiles.length;if(!count)return;
  const small=mobile.matches,w=ring.clientWidth,h=ring.clientHeight;
  // Equal angles spread the front/back and pack the turns. A small overlap
  // exceeds the largest neighbouring horizontal gap at every rotation phase.
  const step=Math.sin(Math.PI/Math.max(2,count)),overlap=1.12;
  const rx=Math.max(0,Math.min((w/2-10)/(1+step*overlap),(small?110:180)/(2*step*overlap)));
  const ry=h*.23,tileWidth=2*rx*step*overlap+2;
  marker.style.width=`${tileWidth+6}px`;marker.style.height=`${h*.52+6}px`;
  tiles.forEach((tile,i)=>{
   const angle=Math.PI+(tile.offset+orbitProgress)/count*Math.PI*2,depth=(Math.cos(angle)+1)/2;
   const x=Math.sin(angle)*rx,y=Math.cos(angle)*ry;
   tile.element.style.width=`${tileWidth}px`;tile.element.style.height=`${h*.52}px`;
   tile.element.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px)`;
   tile.element.style.opacity='1';tile.element.style.zIndex=String(1+Math.round(depth*20));
  });
 }
 function buildRing(){
  const focusedSlot=tiles.findIndex(t=>t.element===document.activeElement);
  const count=Math.min(mobile.matches?10:20,playlist.length);
  ring.replaceChildren(marker);tiles=[];
  for(let i=0;i<count;i++){
   // Consecutive photographs advance into the fixed rear-centre selection.
   const offset=i-Math.floor(count/2),slot=wrap(orbitBase-offset);
   const item=playlist[slot],button=document.createElement('button'),img=document.createElement('img');
   button.className='cinema-tile';button.type='button';button.setAttribute('aria-label',`查看 ${item.memory.title} 的第 ${item.photoIndex+1} 张照片`);
   button.setAttribute('aria-current',String(slot===index));
   img.src=item.thumb;img.alt='';img.decoding='async';button.append(img);
   button.onclick=()=>{setPlaying(false);select(slot);};button.onfocus=()=>{if(playing)setPlaying(false);};
   ring.append(button);tiles.push({element:button,slot,offset});
  }
  layout();if(focusedSlot>=0)focus.focus({preventScroll:true});
 }
 function select(next,animate=true,positionRing=true){
  if(!playlist.length)return;const previous=index;index=wrap(next);
  if(positionRing){elapsed=0;orbitBase=index;orbitProgress=0;}
  const item=playlist[index];
  document.querySelector('#cinemaImageError').hidden=true;presentPhoto(item,animate&&previous!==index);
  focusImage.alt=`${item.memory.title} · 第 ${item.photoIndex+1} 张${item.memory.sample?' · AI 示例照片':''}`;
  focus.setAttribute('aria-label',`暂停并放大：${item.memory.title}，第 ${item.photoIndex+1} 张照片`);
  document.querySelector('#cinemaDate').textContent=[item.memory.date.replaceAll('-','.'),item.memory.place].filter(Boolean).join(' · ');
  document.querySelector('#cinemaPosition').textContent=`${String(index+1).padStart(2,'0')} / ${String(playlist.length).padStart(2,'0')}`;
  document.querySelector('#cinemaProgress').style.transform='scaleX(0)';
  document.querySelector('#cinemaPhotoNumber').textContent=`${String(item.photoIndex+1).padStart(2,'0')} / ${String(item.memory.photos.length).padStart(2,'0')}`;
  if(positionRing)buildRing();
  else tiles.forEach(tile=>tile.element.setAttribute('aria-current',String(tile.slot===index)));
  savePosition();
 }
 function updatePlayback(){
  pause.setAttribute('aria-label',playing?'暂停放映':'继续放映');pause.setAttribute('aria-pressed',String(!playing));
  document.querySelector('#cinemaPlayGlyph').textContent=playing?'Ⅱ':'▶';
  dialog.classList.toggle('is-playing',playing);
 }
 function stopFrame(){cancelAnimationFrame(frame);frame=0;lastTime=0;}
 function tick(time){
  frame=0;if(!dialog.open||!playing||document.hidden||lightbox.open)return;
  const delta=lastTime?Math.min(time-lastTime,250):0;lastTime=time;elapsed+=delta;
  if(!reduced.matches){
   const next=advanceCinemaOrbit(orbitBase,orbitProgress,delta,tiles.length,playlist.length);
   orbitBase=next.base;orbitProgress=next.progress;
   if(next.changed)buildRing();else layout();
  }
  if(elapsed>=duration){
   elapsed%=duration;
   // Sample the photograph nearest the fixed rear-centre marker. Updating the
   // large image never resets, advances or pauses the independently moving ring.
   select(orbitBase+Math.round(orbitProgress),true,false);
  }
  document.querySelector('#cinemaProgress').style.transform=`scaleX(${Math.min(elapsed/duration,1)})`;
  frame=requestAnimationFrame(tick);
 }
 function startFrame(){stopFrame();if(dialog.open&&playing&&!document.hidden&&!lightbox.open)frame=requestAnimationFrame(tick);}
 function setPlaying(value){
  playing=Boolean(value&&playlist.length>1);
  updatePlayback();startFrame();
 }
 function refreshSource(){
  currentSource=document.querySelector('#cinemaSource').value;
  playlist=buildCinemaPlaylist(memories,currentSource);index=0;elapsed=0;
  const hasPhotos=playlist.length>0;document.querySelector('#cinemaEmpty').hidden=hasPhotos;
  stage.hidden=!hasPhotos;ring.hidden=!hasPhotos;document.querySelector('#cinemaCaption').hidden=!hasPhotos;
  document.querySelector('#cinemaControls').hidden=!hasPhotos;
  document.querySelector('#cinemaFooter').hidden=!hasPhotos;
  document.querySelector('#cinemaPrevious').disabled=playlist.length<2;document.querySelector('#cinemaNext').disabled=playlist.length<2;pause.disabled=playlist.length<2;
  if(hasPhotos){select(cinemaStartIndex(playlist,bookmark),false);measure();}else{ring.replaceChildren();tiles=[];focusImage.removeAttribute('src');}
  setPlaying(hasPhotos&&!reduced.matches);
 }
 document.querySelector('#openCinema').onclick=()=>{
  const hasAdded=memories.some(m=>m.persisted&&m.photos.length);
  const source=['all','added'].includes(bookmark?.source)?bookmark.source:(hasAdded?'added':'all');
  dialog.showModal();document.querySelector('#cinemaSource').value=source==='added'&&!hasAdded?'all':source;
  refreshSource();updateClock();clearInterval(clockTimer);clockTimer=setInterval(updateClock,1000);
 };
 document.querySelector('#cinemaExit').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  ++photoRequest;clearPhotoTransition();focus.removeAttribute('aria-busy');
  savePosition();
  setPlaying(false);clearInterval(clockTimer);clockTimer=0;
  if(lightbox.open)lightbox.close();ring.replaceChildren();tiles=[];playlist=[];focusImage.removeAttribute('src');zoomImage.removeAttribute('src');
 });
 pause.onclick=()=>setPlaying(!playing);
 document.querySelector('#cinemaPrevious').onclick=()=>select(index-1);
 document.querySelector('#cinemaNext').onclick=()=>select(index+1);
 document.querySelector('#cinemaSource').onchange=refreshSource;
 focusImage.onerror=()=>{if(dialog.open&&focusImage.getAttribute('src'))document.querySelector('#cinemaImageError').hidden=false;};
 focus.onclick=()=>{
  if(!playlist.length)return;setPlaying(false);const item=playlist[index];zoomImage.src=item.original;zoomImage.alt=focusImage.alt;
  document.querySelector('#cinemaZoomTitle').textContent='回忆照片';
  document.querySelector('#cinemaZoomMeta').textContent=`${item.memory.date.replaceAll('-','.')} · 第 ${item.photoIndex+1} / ${item.memory.photos.length} 张`;
  document.querySelector('#cinemaZoomError').hidden=true;lightbox.showModal();
 };
 zoomImage.onerror=()=>{if(lightbox.open)document.querySelector('#cinemaZoomError').hidden=false;};
 document.querySelector('#cinemaZoomClose').onclick=()=>lightbox.close();
 lightbox.addEventListener('close',()=>{zoomImage.removeAttribute('src');if(dialog.open)focus.focus({preventScroll:true});});
 dialog.addEventListener('keydown',e=>{
  if(lightbox.open||e.target.matches('select,input,textarea'))return;
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();select(index+(e.key==='ArrowRight'?1:-1));}
  if(e.code==='Space'&&e.target===dialog){e.preventDefault();setPlaying(!playing);}
 });
 let touchStart=null,suppressClick=false;
 stage.addEventListener('touchstart',e=>{touchStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
 stage.addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){select(index+(dx<0?1:-1));suppressClick=true;setTimeout(()=>{suppressClick=false;},400);}touchStart=null;},{passive:true});
 stage.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)savePosition();startFrame();});
 window.addEventListener('pagehide',savePosition);
 reduced.addEventListener('change',()=>{if(dialog.open){setPlaying(false);layout();}});
 mobile.addEventListener('change',()=>{if(dialog.open&&playlist.length)buildRing();});
 new ResizeObserver(measure).observe(stage);
 new ResizeObserver(layout).observe(ring);
})();

