const whiteHero={src:'assets/whitehero.webp',alt:'白洋桔梗花朵与绿色茎叶 · AI 示例封面'};
const blueHero={src:'assets/bluehero.webp',alt:'参考花束创作的奶油白蓝缘花朵与细小白花 · AI 示例封面'};
const paletteHeroes={peach:whiteHero,jasmine:whiteHero,rose:blueHero,'white-lisianthus':whiteHero,'blue-letter':blueHero};
const paletteStorageKey='our-little-days.private-view.palette';
const isPalette=theme=>Object.prototype.hasOwnProperty.call(paletteHeroes,theme);
function applyPalette(theme){
  if(!isPalette(theme))return;
  document.body.dataset.theme=theme;
  const selectedHero=paletteHeroes[theme];
  const cover=document.querySelector('.hero-art img');
  cover.src=window.localApp?.hasCover?window.localApp.coverUrl:selectedHero.src;
  cover.alt=window.localApp?.hasCover?'我们的情侣合照':'花卉封面';
  document.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===theme)));
  const selectedButton=document.querySelector(`[data-palette="${theme}"]`);
  document.querySelector('#appearanceButton').title=`外观 · ${selectedButton.textContent.trim()}`;
  document.querySelector('meta[name="theme-color"]').setAttribute('content',getComputedStyle(document.body).getPropertyValue('--deep').trim());
  // Blocked browser storage must not prevent theme switching.
  try{window.privatePreferences.setItem(paletteStorageKey,theme);}catch{}
  if(window.localApp?.settings.theme!==theme)saveLocalSettings({theme}).catch(()=>toast('风格尚未保存在当前浏览器，请稍后重试'));
}
document.querySelectorAll('[data-palette]').forEach(button=>{
  button.addEventListener('click',()=>{
    applyPalette(button.dataset.palette);
    const url=new URL(location.href);
    url.searchParams.set('theme',button.dataset.palette);
    history.replaceState(null,'',url);
    document.querySelector('#appearanceDialog').close();
  });
});
document.querySelector('#appearanceButton').onclick=()=>document.querySelector('#appearanceDialog').showModal();
let savedPalette;
try{savedPalette=window.localApp?.settings.theme||window.privatePreferences.getItem(paletteStorageKey);}catch{}
const linkedPalette=new URLSearchParams(location.search).get('theme');
// Comparison links take priority; the ordinary home page restores the last choice.
applyPalette([linkedPalette,savedPalette,document.body.dataset.theme,'blue-letter'].find(isPalette));
