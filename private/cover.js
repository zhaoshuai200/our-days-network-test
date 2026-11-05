// Relationship dates use Beijing time regardless of the viewing device's time zone.
function relationshipMoment(date,time='00:00'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return NaN;
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
 if(y<1900||m<1||m>12||d<1||h>23||min>59)return NaN;
 const day=new Date(Date.UTC(y,m-1,d));
 if(day.getUTCFullYear()!==y||day.getUTCMonth()!==m-1||day.getUTCDate()!==d)return NaN;
 return Date.UTC(y,m-1,d,h,min)-8*3600000;
}
function relationshipElapsed(start,now){const seconds=Math.max(0,Math.floor((now-start)/1000));return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};}
function nextRelationshipAnniversary(date,now){
 const [,month,day]=date.split('-').map(Number),today=new Date(now+8*3600000);
 function inYear(year){const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();return `${year}-${String(month).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;}
 let year=today.getUTCFullYear(),next=inYear(year);
 const todayDate=`${year}-${String(today.getUTCMonth()+1).padStart(2,'0')}-${String(today.getUTCDate()).padStart(2,'0')}`;
 if(next<todayDate)next=inYear(++year);
 return {date:next,days:Math.round((relationshipMoment(next)-relationshipMoment(todayDate))/86400000)};
}
const coverDefaults={date:'2024-01-01',time:'00:00',title:'日子很长，\n想和你慢慢收藏。',subtitle:'从一顿晚饭，到一场远行。\n每个平凡的瞬间，因为你而值得记住。',eyebrow:'OUR DAYS, ON FILM'};
const coverStorageKey='our-little-days.private-view.cover.v1';
let coverSettings={...coverDefaults};
function validCoverText(value,lines,width){return typeof value==='string'&&value.trim().length>0&&value.split('\n').length<=lines&&value.split('\n').every(line=>line.length<=width);}
try{const saved=window.localApp?.settings.cover||JSON.parse(window.privatePreferences.getItem(coverStorageKey));if(saved&&typeof saved==='object'){
 const savedStart=relationshipMoment(saved.date||'',saved.time||'00:00');
 if(Number.isFinite(savedStart)&&savedStart<=Date.now()){coverSettings.date=saved.date;coverSettings.time=saved.time||'00:00';}
 if(validCoverText(saved.title,2,18))coverSettings.title=saved.title;
 if(validCoverText(saved.subtitle,3,45))coverSettings.subtitle=saved.subtitle;
 if(typeof saved.eyebrow==='string'&&saved.eyebrow.length<=40)coverSettings.eyebrow=saved.eyebrow;
}}catch{}
const coverForm=document.querySelector('#coverForm');
const coverDialog=document.querySelector('#coverSettings');
function updateRelationshipClock(){
 const now=Date.now(),elapsed=relationshipElapsed(relationshipMoment(coverSettings.date,coverSettings.time),now);
 for(const unit of ['days','hours','minutes','seconds'])document.querySelector(`[data-together="${unit}"]`).textContent=unit==='days'?elapsed[unit].toLocaleString('en-US'):String(elapsed[unit]).padStart(2,'0');
 document.querySelector('#togetherNumbers').setAttribute('aria-label',`已在一起 ${elapsed.days} 天 ${elapsed.hours} 小时 ${elapsed.minutes} 分 ${elapsed.seconds} 秒`);
 document.querySelector('#togetherSince').textContent=`从 ${coverSettings.date.replaceAll('-','.')} 开始，把每一天过成我们。`;
 document.querySelector('#introTogether').textContent=`属于我们，和一起走过的 ${elapsed.days.toLocaleString('en-US')} 天`;
 document.querySelector('.us-cover h2').textContent=`已经一起走过 ${elapsed.days.toLocaleString('en-US')} 天，\n还想记录很多很多年。`;
 const anniversaries=document.querySelectorAll('.anniversary');
 anniversaries[0].querySelector('strong').textContent=`${elapsed.days.toLocaleString('en-US')} 天`;
 anniversaries[0].querySelector('p').textContent=`从 ${coverSettings.date.replaceAll('-','.')} 开始`;
 const next=nextRelationshipAnniversary(coverSettings.date,now);
 anniversaries[1].querySelector('strong').textContent=next.days===0?'今天，是我们的纪念日':`还有 ${next.days} 天`;
 anniversaries[1].querySelector('p').textContent=`下一次相恋纪念日 · ${next.date.replaceAll('-','.')}`;
}
function renderCoverSettings(){
 document.querySelector('.hero h1').textContent=coverSettings.title;
 document.querySelector('.hero-copy p').textContent=coverSettings.subtitle;
 const eyebrow=document.querySelector('.hero-copy .eyebrow');eyebrow.textContent=coverSettings.eyebrow;eyebrow.hidden=!coverSettings.eyebrow;
 updateRelationshipClock();
}
document.querySelector('#editCover').onclick=()=>{
 for(const key of Object.keys(coverDefaults))coverForm.elements[key].value=coverSettings[key];
 coverForm.querySelectorAll('input,textarea').forEach(field=>field.setCustomValidity(''));
 document.querySelector('#coverSaveStatus').textContent='';
 coverDialog.showModal();
};
coverForm.querySelectorAll('input,textarea').forEach(field=>field.addEventListener('input',()=>field.setCustomValidity('')));
coverForm.onsubmit=async e=>{
 e.preventDefault();
 const next=Object.fromEntries(Object.keys(coverDefaults).map(key=>[key,coverForm.elements[key].value.trim()]));next.time=next.time||'00:00';
 const start=relationshipMoment(next.date,next.time);
 if(!Number.isFinite(start)||start>Date.now()){coverForm.elements.date.setCustomValidity('请选择有效的相恋日期和时间，不能晚于现在。');coverForm.elements.date.reportValidity();return;}
 if(!validCoverText(next.title,2,18)){coverForm.elements.title.setCustomValidity('标题最多两行，每行最多 18 个字。');coverForm.elements.title.reportValidity();return;}
 if(!validCoverText(next.subtitle,3,45)){coverForm.elements.subtitle.setCustomValidity('短句最多三行，每行最多 45 个字。');coverForm.elements.subtitle.reportValidity();return;}
 try{await saveLocalSettings({cover:next});}catch(error){document.querySelector('#coverSaveStatus').textContent=error.message;return;}
 coverSettings=next;renderCoverSettings();
 try{window.privatePreferences.setItem(coverStorageKey,JSON.stringify(next));}catch{}coverDialog.close();toast('封面与计时已保存在当前浏览器');
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateRelationshipClock();});
renderCoverSettings();setInterval(()=>{if(!document.hidden)updateRelationshipClock();},1000);
