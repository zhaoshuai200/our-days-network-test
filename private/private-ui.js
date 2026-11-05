document.title='把日子收藏 · 我们的相册';
document.querySelector('.preview-note').textContent='加密相册 · 只读体验 · 原始文件保留在电脑备份中';
document.querySelector('.appearance-note').textContent='外观选择仅在本次打开期间有效';
const privateNote=document.createElement('p');privateNote.className='private-session-note';privateNote.textContent='精选和外观调整仅在本次解锁期间有效。';document.querySelector('.footer').append(privateNote);
