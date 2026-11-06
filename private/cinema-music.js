(()=>{
 const dialog=document.querySelector('#cinema'),footer=document.querySelector('#cinemaFooter'),track=window.localApp.music;
 if(!track)return;
 const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;justify-content:center;gap:10px;grid-column:1/-1;font-size:12px;color:inherit';footer.prepend(line);
 const label=document.createElement('span');label.textContent=[track.title,track.artist].filter(Boolean).join(' · ');
 const button=document.createElement('button');button.type='button';button.style.cssText='font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:18px;padding:3px 12px';
 const audio=new Audio();audio.loop=true;audio.preload='none';let ctrl=null,active=0;
 line.append(label,button);const state=s=>button.textContent=s;state('播放音乐');
 async function play(){const id=++active;ctrl?.abort();ctrl=new AbortController();try{
   if(!audio.src){state('取消加载');button.setAttribute('aria-busy','true');audio.src=await window.resolvePrivatePhoto('/mobile/music',{priority:1,quality:'full',signal:ctrl.signal});}
   if(id!==active||!dialog.open)return;button.removeAttribute('aria-busy');await audio.play();if(id===active)state('暂停音乐');
  }catch(e){if(id!==active)return;button.removeAttribute('aria-busy');state(e.name==='NotAllowedError'?'点此播放':'重试播放');}}
 function stop(){++active;ctrl?.abort();audio.pause();state('播放音乐');button.removeAttribute('aria-busy');}
 button.onclick=()=>{if(button.hasAttribute('aria-busy')||!audio.paused)stop();else play();};
 document.querySelector('#openCinema').addEventListener('click',()=>{if(dialog.open)play();});
 dialog.addEventListener('close',stop);window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 audio.addEventListener('error',()=>{if(dialog.open){audio.removeAttribute('src');state('重试播放');}});
})();
