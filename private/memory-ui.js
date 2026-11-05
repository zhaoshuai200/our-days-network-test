const iconPaths={
 album:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m4-12h4m-4 4h4"/>',
 pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
 photo:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
 heart:'<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5Z"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>'
};
function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.photo}</svg>`;}
const hasLocalLibrary=Array.isArray(window.localMemories);
const initial=()=>hasLocalLibrary?structuredClone(window.localMemories):[];
let memories=initial(),filter='全部',place='',urls=[],draft=[],draftCover=0,loadingPhotos=false,importVersion=0,toastTimer,activeMemory=null,activePhoto=0;
$('.hero').classList.add('personal-cover');
$('#heroArt').innerHTML=`<img src="${window.localApp?.hasCover?window.localApp.coverUrl:'assets/bluehero.webp'}" alt="${window.localApp?.hasCover?'我们的情侣合照':'花卉封面'}" fetchpriority="high">`;
$('#openCollection').onclick=()=>$('#filters').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
$('[data-page="time"] .nav-icon').innerHTML=icon('album');
$('[data-page="places"] .nav-icon').innerHTML=icon('pin');
$$('[data-close]').forEach(b=>b.innerHTML=icon('close'));
const categoryIcons={'全部':'album','日常':'heart','旅行':'pin','纪念':'calendar'};
$$('[data-filter]').forEach(b=>b.innerHTML=icon(categoryIcons[b.dataset.filter])+`<span>${b.textContent}</span>`);
$$('.anniversary h3').forEach((h,i)=>h.innerHTML=icon(i?'calendar':'heart')+`<span>${i?'下一个纪念日':'在一起的日子'}</span>`);
function albumHasLongStory(m){return (m.sourceBatches?.map(b=>b.note).join('\n')||m.text||'').length>160;}
function albumNotes(m){
 if(!m.sourceBatches)return esc(m.text||'有些喜欢，照片会替我们记得。').replaceAll('\n','<br>');
 return m.sourceBatches.map(b=>`<span class="batch-note" data-batch-start="${b.start}" data-batch-end="${b.start+b.count}"><small>第 ${b.start+1}–${b.start+b.count} 张</small>${esc(b.note).replaceAll('\n','<br>')}</span>`).join('');
}
function updateFilmPick(){
 const button=$('#filmPick');if(!button)return;
 const picks=activeMemory.cinemaPicks||activeMemory.photos,chosen=picks.includes(activeMemory.photos[activePhoto]);
 button.setAttribute('aria-pressed',String(chosen));button.textContent=chosen?'★ 已选入放映精选':'☆ 选入放映精选';
 button.title=`本相册已选 ${picks.length} / ${activeMemory.photos.length} 张；选择只在本次打开期间有效`;
 $('#filmPickStatus').textContent=`本相册 ${picks.length} / ${activeMemory.photos.length} 张参与精选放映`;
}
async function toggleFilmPick(){
 const memory=activeMemory,src=memory.photos[activePhoto],button=$('#filmPick');
 const current=memory.cinemaPicks||memory.photos;
 const photos=current.includes(src)?current.filter(p=>p!==src):[...current,src];
 button.disabled=true;
 try{
  const response=await appRequest('/cinema-picks',{method:'PUT',body:{id:memory.id,photos}});
  if(!response.ok)throw new Error('Save failed');
  memory.cinemaPicks=photos;
  const original=window.localMemories.find(m=>m.id===memory.id);if(original)original.cinemaPicks=[...photos];
  if(activeMemory===memory){updateFilmPick();$('#filmPickStatus').textContent+= ' · 已保存';}
 }catch{if(activeMemory===memory)$('#filmPickStatus').textContent='暂时未保存，请重试。';}
 finally{button.disabled=false;}
}
function placeholder(){return `<div class="photo-placeholder">${icon('album')}<span>用文字，留住这一天</span></div>`;}
function card(m){const cover=(m.thumbs||m.photos)[m.cover||0];return `<button class="card" data-id="${m.id}" aria-label="查看回忆：${esc(m.title)}，${m.photos.length} 张照片"><div class="card-art">${cover?`<img src="${esc(cover)}" alt="${esc(m.title)}${m.sample?' · AI 示例照片':''}" loading="lazy">`:placeholder()}<span class="card-date">${esc((m.date?m.date.replaceAll('-','.'):'日期待补'))}</span>${m.photos.length?`<span class="album-count">${icon('photo')} ${m.photos.length}<span class="album-word"> 张照片</span></span>`:''}</div><div class="card-body"><div class="card-kicker"><span>${esc(m.category)}</span><span>${m.sample?'示例相册':m.persisted?'我们的相册':'本次记录'}</span></div><h3 class="card-title">${esc(m.title)}</h3><p class="card-desc">${esc(m.text||'留下一张照片，也留下一点喜欢。')}</p><div class="card-foot"><span class="card-place">${icon('pin')}${esc(m.place||'未填写地点')}</span><span class="card-open">翻开这一刻 ${icon('arrow')}</span></div></div></button>`;}
function render(){const list=memories.filter(m=>filter==='全部'||m.category===filter).sort((a,b)=>b.date.localeCompare(a.date));let html='',year='';for(const m of list){const y=m.date.slice(0,4)||'日期待补';if(y!==year){if(year)html+='</div>';html+=`<div class="year-label">${y}<small>这一年的我们</small></div><div class="cards">`;year=y;}html+=card(m);}$('#timeline').innerHTML=html+(year?'</div>':'<p class="empty">这一页，等下一段回忆。</p>');$('#count').textContent=memories.length;$('#photoCount').textContent=memories.reduce((n,m)=>n+m.photos.length,0);$$('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});renderPlaces();}
function renderPlaces(){const list=memories.filter(m=>place?m.place===place:(hasLocalLibrary?Boolean(m.place):m.category==='旅行'));$('#placeCards').innerHTML=list.map(card).join('')||'<p class="empty">这个地点还没有回忆。</p>';$('#placeTitle').textContent=place?`${place}，和你一起`:(hasLocalLibrary?'一起走过的地方':'旅途里的小片段');$$('[data-place]').forEach(b=>{b.classList.toggle('active',b.dataset.place===place);b.setAttribute('aria-pressed',String(b.dataset.place===place));});}
function go(page){$$('.page').forEach(p=>p.classList.toggle('hidden',p.id!==page));$$('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});window.scrollTo({top:0,behavior:'instant'});}
function setPhoto(index){if(!activeMemory?.photos.length)return;activePhoto=Math.max(0,Math.min(index,activeMemory.photos.length-1));const photo=$('#detailPhoto');const dimensions=activeMemory.sizes?.[activePhoto];$('#detail').classList.toggle('portrait-album',Boolean(dimensions&&dimensions.height>dimensions.width));photo.onload=()=>$('#detail').classList.toggle('portrait-album',photo.naturalHeight>photo.naturalWidth);const requestedMemory=activeMemory,requestedIndex=activePhoto;photo.src=activeMemory.thumbs[activePhoto];if($('#detailOriginal'))$('#detailOriginal').removeAttribute('href');window.resolvePrivatePhoto(activeMemory.photos[activePhoto]).then(url=>{if(activeMemory!==requestedMemory||activePhoto!==requestedIndex||!$('#detail').open)return;photo.src=url;if($('#detailOriginal'))$('#detailOriginal').href=url;}).catch(()=>{if(activeMemory===requestedMemory&&activePhoto===requestedIndex)toast('清晰照片加载失败，请重新点选这张照片。');});photo.alt=`${activeMemory.title} · 第 ${activePhoto+1} 张${activeMemory.sample?' · AI 示例照片':''}`;$('#photoPosition').textContent=`${String(activePhoto+1).padStart(2,'0')} / ${String(activeMemory.photos.length).padStart(2,'0')}`;$$('[data-photo]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.photo)===activePhoto)));if($('#previousPhoto')){$('#previousPhoto').disabled=activePhoto===0;$('#nextPhoto').disabled=activePhoto===activeMemory.photos.length-1;}updateFilmPick();$$('[data-batch-start]').forEach(n=>n.classList.toggle('current-batch',activePhoto>=Number(n.dataset.batchStart)&&activePhoto<Number(n.dataset.batchEnd)));const thumb=$(`[data-photo="${activePhoto}"]`);if(thumb)thumb.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
function showDetail(id){const m=memories.find(x=>String(x.id)===String(id));if(!m)return;activeMemory=m;$('#detailBody').innerHTML=`<div class="album-layout ${albumHasLongStory(m)?'with-story':'photo-first'}"><div class="album-visual"><div class="detail-art">${m.photos.length?`<img id="detailPhoto" src="${esc(m.thumbs[m.cover||0])}" alt="${esc(m.title)}">`:placeholder()}${m.photos.length>1?`<button class="gallery-arrow prev" id="previousPhoto" aria-label="上一张照片">${icon('arrow')}</button><button class="gallery-arrow next" id="nextPhoto" aria-label="下一张照片">${icon('arrow')}</button>`:''}${m.photos.length?'<span class="photo-position" id="photoPosition" role="status" aria-live="polite"></span>':''}</div>${m.photos.length>1?'<div class="thumbs" aria-label="相册照片">'+(m.thumbs||m.photos).map((u,i)=>`<button data-photo="${i}" aria-label="查看第 ${i+1} 张照片" aria-pressed="false"><img src="${esc(u)}" alt="" loading="lazy"><span>${String(i+1).padStart(2,'0')}</span></button>`).join('')+'</div><p class="gallery-hint">点选照片，慢慢翻看 · 也可左右滑动</p>':''}</div><div class="album-story"><div class="story-eyebrow">${icon(categoryIcons[m.category])}${esc(m.category)} / ${m.photos.length} 张照片</div><h2 class="detail-title">${esc(m.title)}</h2><div class="detail-meta"><span>${icon('calendar')}${esc((m.date?m.date.replaceAll('-','.'):'日期待补'))}</span><span>${icon('pin')}${esc(m.place||'未填写地点')}</span></div><p class="detail-text">${albumNotes(m)}</p>${m.originals?.length?'<a id="detailOriginal" target="_blank" rel="noopener noreferrer" class="original-link">查看清晰照片 ↗</a>':''}${m.persisted&&m.photos.length?'<button type="button" class="film-pick" id="filmPick" aria-pressed="false"></button><p class="film-pick-status" id="filmPickStatus" role="status"></p>':''}${m.persisted?'<button type="button" class="annotation-edit" id="editAnnotation">编辑标注</button>':''}<div class="story-end">to be continued <span>♡</span></div><p class="detail-disclaimer">${m.sample?'示例相册 · 使用 AI 图片演示多图浏览，非真实回忆。':m.persisted?'照片保留完整比例 · 在线清晰版最长边 2560 像素，原始文件保存在电脑备份中。':'本次试填 · 照片未上传，刷新后清除。请保留原文件。'}</p></div></div>`;$$('[data-photo]').forEach(b=>b.onclick=()=>setPhoto(Number(b.dataset.photo)));if($('#nextPhoto')){$('#previousPhoto').onclick=()=>setPhoto(activePhoto-1);$('#nextPhoto').onclick=()=>setPhoto(activePhoto+1);}let touchStart;$('.detail-art').addEventListener('touchstart',e=>{if(e.touches.length===1)touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});$('.detail-art').addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4)setPhoto(activePhoto+(dx<0?1:-1));touchStart=null;},{passive:true});if($('#filmPick'))$('#filmPick').onclick=toggleFilmPick;$('#detail').showModal();setPhoto(m.cover||0);$('#detail').scrollTop=0;}
$('#detail').addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setPhoto(activePhoto+(e.key==='ArrowRight'?1:-1));}});
document.addEventListener('click',e=>{const c=e.target.closest('[data-id]');if(c)showDetail(c.dataset.id);});
if(hasLocalLibrary){
 document.title='把日子收藏 · 我们的相册';
 $('#reset').textContent='刷新相册';
 $('.preview-note').textContent='加密相册 · 只读体验';
 $('#cinemaSource option[value="all"]').textContent='全部回忆';
 $('#cinemaSource option[value="added"]').textContent='放映精选';
 const locations=[...new Set(memories.map(m=>m.place).filter(Boolean))];
 const positions=[[22,31],[66,23],[51,52],[76,70],[26,73]];
 $$('[data-place]').forEach(b=>b.remove());
 locations.forEach((name,i)=>{const button=document.createElement('button');button.className='place-pin';button.dataset.place=name;button.textContent=name;const small=document.createElement('small');small.textContent=memories.filter(m=>m.place===name).length+' 段回忆';button.append(small);const [left,top]=positions[i%positions.length];button.style.left=left+'%';button.style.top=top+'%';$('.map-board').append(button);});
 $('.map-note').textContent='我们记录的地点 · 此处排列为示意，不代表地理位置';
}
$$('[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});$$('[data-place]').forEach(b=>b.onclick=()=>{place=b.dataset.place;renderPlaces();});$('#allPlaces').onclick=()=>{place='';renderPlaces();};$$('[data-chapter]').forEach(b=>b.onclick=()=>{filter=b.dataset.chapter;render();go('time');$('#filters').scrollIntoView({block:'start'});});$$('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#add').onclick=()=>document.querySelector('#testInfo').showModal();
function toast(t){clearTimeout(toastTimer);$('#toast').textContent=t;$('#toast').classList.remove('hidden');toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),4500);}
$('#reset').textContent='刷新相册';$('#reset').onclick=()=>location.reload();
render();
