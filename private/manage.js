(()=>{
 'use strict';const M=MobileAlbum,$=id=>document.getElementById(id),status=s=>$('status').textContent=s;
 let op=null,busy=false,previewUrls=[],published=null,epoch=0,controller;
 const today=new Date();$('date').value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 function clearPreviews(){for(const u of previewUrls)URL.revokeObjectURL(u);previewUrls=[];$('previews').replaceChildren();$('previewAudio').pause();$('previewAudio').removeAttribute('src');$('previewAudio').load();$('previewAudio').hidden=true;}
 function url(file){const u=URL.createObjectURL(file);previewUrls.push(u);return u;}
 function resetOperation(){op=null;published=null;$('check').hidden=$('result').hidden=true;$('submit').disabled=false;status('');}
 $('fields').addEventListener('input',e=>{if(!['key','token'].includes(e.target.id))resetOperation();});
 $('mode').onchange=()=>{resetOperation();const music=$('mode').value==='music';$('photosPane').hidden=music;$('musicPane').hidden=!music;};
 $('photos').onchange=()=>{resetOperation();clearPreviews();const files=[...$('photos').files];for(const f of files.slice(0,12)){const img=new Image();img.alt='待发布照片';img.src=url(f);$('previews').append(img);}status('已选择 '+files.length+' 张照片。');};
 $('music').onchange=()=>{resetOperation();clearPreviews();const f=$('music').files[0];if(f){$('song').value=f.name.replace(/\.[^.]+$/,'');$('previewAudio').src=url(f);$('previewAudio').hidden=false;}};
 const val=id=>$(id).value.trim();
 async function deployed(key,id){const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),10000);try{const res=await fetch('vault/mobile.bin?t='+Date.now(),{signal:ctrl.signal,cache:'no-store'});if(!res.ok)return false;return (await M.openState(new Uint8Array(await res.arrayBuffer()),key)).applied.includes(id);}catch{return false;}finally{clearTimeout(t);}}
 async function check(){const p=published;if(!p)return;$('check').disabled=true;const done=await deployed(p.key,p.id);if(p!==published)return;$('check').disabled=false;
  if(done){status('已上线。重新打开相册，就能看到这次更新。');$('result').hidden=false;$('check').hidden=true;}else status('已提交给 GitHub，网站仍在发布。请稍后检查，不用再次上传。');}
 $('check').onclick=check;
 $('editor').onsubmit=async e=>{e.preventDefault();if(busy||published)return;const run=++epoch;let localOp;
  try{
   const music=val('mode')==='music',files=Array.from($('photos').files),track=$('music').files[0];
   if(!val('token').startsWith('github_pat_'))throw Error('请使用仅限本仓库的 fine-grained 上传令牌。');
   if(music){if(!track||!val('song')||!track.size||track.size>12*1048576||!(/\.(mp3|m4a)$/i.test(track.name)))throw Error('请选择 12 MB 以内的 MP3 或 M4A，并填写歌名。');if($('previewAudio').error)throw Error('手机无法播放这首歌，请改选可试听的音频文件。');}
   else{if(!files.length||files.length>12||files.some(f=>!f.size||f.size>32*1048576))throw Error('一次请选择 1 至 12 张照片，单张不超过 32 MB。');if(!val('title')||!/^\d{4}-\d{2}-\d{2}$/.test(val('date')))throw Error('请填写回忆标题和日期。');}
   busy=true;$('fields').disabled=true;controller=new AbortController();const sig=controller.signal,key=await M.importKey(val('key')),api=M.github(val('token'),sig);status('正在核对相册密钥和维护目录…');
   const first=await M.snapshot(api,key);sig.throwIfAborted();
   if(!op)op={id:M.uid(),entries:[],change:null};localOp=op;
   if(!first.state.applied.includes(op.id)&&!op.change){
    op.entries=[];const put=async data=>{sig.throwIfAborted();return M.asset(api,key,data,localOp.entries);};
    if(music){status('正在加密并上传音乐…');const file=await put(new Uint8Array(await track.arrayBuffer()));op.change={id:op.id,music:{file,mime:/\.mp3$/i.test(track.name)?'audio/mpeg':'audio/mp4',title:val('song'),artist:val('artist')}};}
    else{const r={id:'mobile-'+op.id,persisted:true,title:val('title'),date:val('date'),place:val('place'),category:val('category'),text:val('note'),cover:0,photos:[],originals:[],thumbs:[],sizes:[],cinemaPicks:[]},mediaIndex={},viewIndex={},chunks=[],thumbs={};let thumbSize=0;
     async function flush(){if(!thumbSize)return;chunks.push(await put(M.enc.encode(JSON.stringify(thumbs))));for(const k of Object.keys(thumbs))delete thumbs[k];thumbSize=0;}
     for(let i=0;i<files.length;i++){status('正在处理第 '+(i+1)+' / '+files.length+' 张照片…');const v=await M.variants(files[i]),route='/mobile/'+op.id+'/'+i,thumb=route+'/thumb';
      status('正在加密上传第 '+(i+1)+' / '+files.length+' 张照片…');mediaIndex[route]={file:await put(v.full.data),mime:v.full.mime};viewIndex[route]={file:await put(v.view.data),mime:v.view.mime};
      r.photos.push(route);r.originals.push(route);r.sizes.push({width:v.width,height:v.height});r.thumbs.push(thumb);if(i<3)r.cinemaPicks.push(route);
      const data=M.b64(v.thumb.data);if(thumbSize+data.length>300*1024)await flush();thumbs[thumb]={data,mime:v.thumb.mime};thumbSize+=data.length;
     }await flush();op.change={id:op.id,record:r,mediaIndex,viewIndex,chunks};
    }
   }
   status('正在发布这次更新…');if(!first.state.applied.includes(op.id))await M.publish(api,key,op.change,op.entries,first);sig.throwIfAborted();
   published={key,id:op.id};$('submit').disabled=true;$('check').hidden=false;status('提交成功，网站正在自动更新。');await check();
  }catch(error){if(run===epoch)status((error.message||'未完成发布')+'\n如需重试，请保留本页的选择。');}
  finally{if(run===epoch){busy=false;$('fields').disabled=false;}}
 };
 window.addEventListener('pagehide',()=>{epoch++;controller?.abort();clearPreviews();$('editor').reset();$('key').value=$('token').value='';published=op=null;busy=false;});
 window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
})();
