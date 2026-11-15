/* 이전 메뉴를 노출하지 않고 같은 로그인 세션의 마지막 메뉴를 먼저 표시합니다. */
(() => {
 'use strict';
 const cacheKey='logbook.navigation.v1';
 function session(){try{const value=JSON.parse(localStorage.getItem('logbook.session.v1')||'null');return value?.token?.startsWith('session.')&&value.expiresAt>Date.now()?value.token.slice(-32):'';}catch(_){return '';}}
 function preview(){
  const nav=document.getElementById('sidebarMenu');if(!nav)return;
  document.getElementById('navigationPreview')?.remove();
  const box=document.createElement('nav');box.id='navigationPreview';box.inert=true;box.setAttribute('aria-label','메뉴 연결 확인 중');
  let cached;try{cached=JSON.parse(localStorage.getItem(cacheKey)||'null');}catch(_){}
  const identity=session();
  if(identity&&cached?.session===identity&&Array.isArray(cached.groups)){
   for(const group of cached.groups.slice(0,50)){
    if(!group||typeof group!=='object')continue;
    const section=document.createElement('section');section.className='tree-group';
    const head=document.createElement('div');head.className='tree-group-head';
    const title=document.createElement('button');title.className='tree-group-toggle';title.type='button';title.textContent=String(group.title||'').slice(0,100);head.appendChild(title);section.appendChild(head);
    const list=document.createElement('div');list.className='tree-items';
    for(const label of (Array.isArray(group.items)?group.items:[]).slice(0,100)){
     const row=document.createElement('div');row.className='tree-nav-item nav-sort-row';
     const button=document.createElement('button');button.type='button';button.className='nav-item';button.textContent=String(label).slice(0,100);row.appendChild(button);list.appendChild(row);
    }
    section.appendChild(list);box.appendChild(section);
   }
  }
  if(!box.childNodes.length){const note=document.createElement('p');note.className='navigation-loading';note.textContent='메뉴를 불러오는 중…';box.appendChild(note);}
  nav.before(box);
 }
 function commit(save=true){
  const nav=document.getElementById('sidebarMenu'),identity=session();
  if(save&&nav&&identity){const groups=Array.from(nav.querySelectorAll('.tree-group')).map(group=>({title:group.querySelector('.tree-group-toggle')?.textContent||'',items:Array.from(group.querySelectorAll('.tree-display-title')).map(x=>x.textContent)}));
   try{localStorage.setItem(cacheKey,JSON.stringify({session:identity,groups}));}catch(_){}
  }
  document.getElementById('navigationPreview')?.remove();document.documentElement.removeAttribute('data-navigation-pending');
 }
 function clear(){try{localStorage.removeItem(cacheKey);}catch(_){}document.getElementById('navigationPreview')?.remove();}
 window.LOGBOOK_NAVIGATION={preview,commit,clear};
})();
