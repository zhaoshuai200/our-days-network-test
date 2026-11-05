const testStateKey='our-little-days.github-album-test.state.v1';
try {const saved=JSON.parse(localStorage.getItem(testStateKey));if(saved){window.localApp.settings=saved.settings||{};for(const m of window.localMemories){const edit=saved.edits?.[m.id];if(edit){for(const key of ['title','date','place','category','text','sourceBatches','cinemaPicks'])if(edit[key]!==undefined)m[key]=edit[key];}}}}catch{}
function persistTestState(settings,records){
 const edits=Object.fromEntries(records.map(m=>[m.id,Object.fromEntries(['title','date','place','category','text','sourceBatches','cinemaPicks'].filter(k=>m[k]!==undefined).map(k=>[k,m[k]]))]));
 try{localStorage.setItem(testStateKey,JSON.stringify({settings,edits}));}catch{throw new Error('浏览器未允许保存，修改尚未保存。');}
 window.localApp.settings=settings;window.localMemories=records;
}
async function appRequest(route,{body}={}){
 const records=structuredClone(window.localMemories),settings=structuredClone(window.localApp.settings);
 if(route==='/api/settings'){Object.assign(settings,body);persistTestState(settings,records);return {settings};}
 const id=route==='/cinema-picks'?body.id:route.split('/').pop(),memory=records.find(m=>m.id===id);if(!memory)throw new Error('此操作不属于本次测试');
 if(route==='/cinema-picks'){if(!Array.isArray(body.photos)||body.photos.some(p=>!memory.photos.includes(p)))throw new Error('无效选择');memory.cinemaPicks=body.photos;}
 else if(route.startsWith('/api/memories/')){for(const key of ['title','date','place','category','text'])memory[key]=String(body[key]||'');if(memory.sourceBatches)memory.sourceBatches.forEach((b,i)=>b.note=String(body.notes?.[i]||''));}
 else throw new Error('在线上传和同步尚未开通');
 persistTestState(settings,records);return {ok:true,memory};
}
async function saveLocalSettings(changes){return appRequest('/api/settings',{body:changes});}
