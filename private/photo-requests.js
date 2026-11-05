// Share downloads, reserve capacity for opened photos, and stop unused requests.
window.createPhotoRequests=({load,signal})=>{
 const cache=new Map(),tasks=new Map(),queue=[];let running=0,background=0;
 function pump(){
  if(signal.aborted)return;
  queue.sort((a,b)=>b.priority-a.priority);
  while(running<2){
   const index=queue.findIndex(t=>t.priority>0||background<1);if(index<0)return;
   const task=queue.splice(index,1)[0];task.started=true;running++;const bg=task.priority===0;if(bg)background++;
   const report=p=>{task.last=p;for(const user of task.users)user.report?.(p);};
   load(task.id,task.controller.signal,report).then(value=>{
    if(task.controller.signal.aborted)return;
    cache.set(task.id,value);for(const user of [...task.users])user.finish(null,value);
   },error=>{for(const user of [...task.users])user.finish(error);}).finally(()=>{
    if(tasks.get(task.id)===task)tasks.delete(task.id);running--;if(bg)background--;pump();
   });
  }
 }
 return (id,options={})=>{
  if(signal.aborted||options.signal?.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  if(cache.has(id))return Promise.resolve(cache.get(id));
  let task=tasks.get(id);
  if(!task){task={id,priority:options.priority||0,controller:new AbortController(),users:new Set(),started:false,last:{phase:'queued'}};tasks.set(id,task);queue.push(task);}
  task.priority=Math.max(task.priority,options.priority||0);
  const promise=new Promise((resolve,reject)=>{
   const user={report:options.onProgress,finish(error,value){
    if(!task.users.delete(user))return;signal.removeEventListener('abort',cancel);options.signal?.removeEventListener('abort',cancel);error?reject(error):resolve(value);
   }};
   const cancel=()=>{
    user.finish(new DOMException('Cancelled','AbortError'));
    if(!task.users.size){task.controller.abort();const i=queue.indexOf(task);if(i>=0)queue.splice(i,1);if(tasks.get(id)===task)tasks.delete(id);pump();}
   };
   task.users.add(user);signal.addEventListener('abort',cancel,{once:true});options.signal?.addEventListener('abort',cancel,{once:true});user.report?.(task.last);
  });pump();return promise;
 };
};
