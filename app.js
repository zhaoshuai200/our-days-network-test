'use strict';
const $=id=>document.getElementById(id),names=['花与日常','海风与远方','安静的小巷'];
const paths=['./samples/flowers.jpg','./samples/sea.jpg','./samples/lane.jpg'];
const fresh=new URLSearchParams(location.search).has('fresh'),stamp=Date.now();
const sources=paths.map(p=>fresh?`${p}?test=${stamp}`:p),results=Array(3).fill(null);
let current=0,timer=null;
$('scriptStatus').textContent='✓ 脚本正常';
function show(index){current=(index+3)%3;$('hero').src=sources[current];$('hero').alt=names[current]+' · 测试插画';$('page').textContent=`${current+1} / 3`;}
function stop(){clearInterval(timer);timer=null;$('play').textContent='开始轮播';}
function report(){return ['相册 GitHub Pages 访问测试','测试时间：'+new Date().toLocaleString(),'页面：可以打开','脚本：正常',...names.map((n,i)=>`${n}：${results[i]===null?'加载中':results[i]===false?'未加载成功':results[i]+' 秒'}`),'轮播是否流畅：请补充','使用流量 / Wi-Fi：请补充','浏览器 / 微信：请补充','是否关闭代理：请补充'].join('\n');}
function update(){const done=results.filter(x=>x!==null).length,ok=results.filter(x=>typeof x==='string').length;$('imageStatus').textContent=`图片已加载 ${ok} / 3${done<3?'，其余仍在加载…':''}`;$('summary').textContent=done<3?'首次加载中，请稍等；超过 20 秒仍未显示会标为未成功。':ok===3?'三张图片均已加载，请再检查轮播是否流畅。':'部分图片未成功加载，请将测试结果告诉我。';$('report').value=report();}
sources.forEach((src,i)=>{const button=document.createElement('button');button.setAttribute('aria-label','查看'+names[i]);const img=new Image();img.alt=names[i];button.append(img);$('thumbs').append(button);button.onclick=()=>{stop();show(i);};const start=performance.now();let finished=false;const finish=value=>{if(finished)return;finished=true;clearTimeout(timeout);results[i]=value;update();};const timeout=setTimeout(()=>finish(false),20000);img.onload=()=>finish(((performance.now()-start)/1000).toFixed(2));img.onerror=()=>finish(false);img.src=src;});
$('prev').onclick=()=>{stop();show(current-1);};$('next').onclick=()=>{stop();show(current+1);};$('play').onclick=()=>{if(timer)stop();else{timer=setInterval(()=>show(current+1),3000);$('play').textContent='暂停轮播';}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
$('copy').onclick=async()=>{$('report').hidden=false;$('report').value=report();try{await navigator.clipboard.writeText(report());$('copyStatus').textContent='已复制，可以粘贴给我。';}catch{$('report').focus();$('report').select();$('copyStatus').textContent='请长按下方结果，选择并复制。';}};
$('retry').href='?fresh='+Date.now();show(0);
