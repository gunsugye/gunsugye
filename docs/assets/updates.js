/* 정적 배포 정보만 확인합니다. 업무 자료 조회나 시트 API 호출은 발생하지 않습니다. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),running=document.documentElement.dataset.releaseId||'',key='logbook.release.seen.v1';
 let latest=null,busy=false,started=false,lastCheck=0,dismissed='';
 const subscribers=new Set();
 const seen=()=>{try{return localStorage.getItem(key)||dismissed;}catch(_){return dismissed;}};
 function dismiss(){if(latest){dismissed=latest.id;try{localStorage.setItem(key,latest.id);}catch(_){}}$('pagesUpdateNotice').hidden=true;}
 function render(force=false){
  if(!latest)return;
  const needsReload=latest.id!==running;
  $('pagesUpdateLauncher').hidden=false;$('pagesUpdateLauncher').textContent=needsReload?'새 업데이트':'업데이트 안내';
  $('pagesUpdateVersion').textContent='v'+latest.version+' · '+latest.title;
  $('pagesUpdateNotes').replaceChildren(...latest.notes.map(note=>{const li=document.createElement('li');li.textContent=note;return li;}));
  $('pagesUpdateApply').textContent=needsReload?'새 버전 적용':'확인';
  $('pagesUpdateHelp').textContent=needsReload?'저장한 뒤 새 버전을 불러오세요.':'현재 최신 버전을 사용하고 있습니다.';
  if(force||seen()!==latest.id)$('pagesUpdateNotice').hidden=false;
 }
 async function check(force=false){
  if(busy||document.visibilityState==='hidden'||(!force&&Date.now()-lastCheck<10000))return;
  busy=true;lastCheck=Date.now();
  try{
   const response=await fetch('./release.json?t='+Date.now(),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
   if(!response.ok)return;const r=await response.json();
   if(!r||!/^[a-f0-9]{16}$/.test(r.id)||typeof r.version!=='string'||typeof r.title!=='string'||!Array.isArray(r.notes)||r.notes.length>12||r.notes.some(x=>typeof x!=='string'||x.length>500))return;
   const changed=latest?.id!==r.id;latest=r;render();
   if(changed)for(const listener of subscribers){try{listener(latest);}catch(_){}}
  }catch(_){/* 업무 화면을 방해하지 않고 다음 주기에 재확인합니다. */}
  finally{busy=false;}
 }
 const openNotice=()=>{if(latest)render(true);check(true);};
 const applyUpdate=()=>{
  if(!latest)return;if(latest.id===running){dismiss();return;}
  try{
   const state=window.logbookReloadState?.();
   if(state?.busy){$('pagesUpdateHelp').textContent='저장 중입니다. 완료 후 다시 적용해 주세요.';return;}
   if(state?.dirty&&!window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 새 버전을 적용할까요?')){$('pagesUpdateHelp').textContent='적용을 취소했습니다. 저장한 뒤 다시 적용해 주세요.';return;}
   $('pagesUpdateHelp').textContent='새 버전을 불러오는 중…';
   const url=new URL(location.href);url.searchParams.set('appUpdate',latest.id);location.assign(url.href);
  }catch(error){$('pagesUpdateHelp').textContent='적용 실패: '+String(error.message||error)+' · 브라우저 새로고침으로 다시 불러와 주세요.';}
 };
 $('pagesUpdateClose').addEventListener('click',dismiss);
 $('pagesUpdateLauncher').addEventListener('click',openNotice);
 $('pagesUpdateApply').addEventListener('click',applyUpdate);
 // 메뉴 재구성·버튼 교체 이후에도 같은 클릭 경로를 사용합니다.
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('#pagesUpdateClose,#pagesUpdateLauncher,#pagesUpdateApply,[data-view="updates"]');if(!button)return;
  if(button.dataset?.view==='updates'){
   if(!window.LOGBOOK_OPEN_UPDATES)return;
   const handled=window.LOGBOOK_OPEN_UPDATES();if(handled===null)return;
   check(true);event.preventDefault();event.stopImmediatePropagation();return;
  }
  event.preventDefault();event.stopImmediatePropagation();
  if(button.id==='pagesUpdateClose')dismiss();
  else if(button.id==='pagesUpdateLauncher')openNotice();
  else if(latest)applyUpdate();
  else{check(true).then(()=>{if(latest)applyUpdate();else $('pagesUpdateHelp').textContent='업데이트 정보를 불러오지 못했습니다. 다시 눌러 주세요.';});}
 },true);
 function start(){if(started)return;started=true;const host=document.querySelector('.topbar-right');if(host)host.append($('pagesUpdateLauncher'));check();setInterval(()=>check(),10000);document.addEventListener('visibilitychange',()=>check(true));window.addEventListener('focus',()=>check(true));window.addEventListener('online',()=>check(true));}
 window.LOGBOOK_UPDATES={start,refresh:()=>check(true),getLatest:()=>latest,subscribe:listener=>{subscribers.add(listener);return()=>subscribers.delete(listener);}};
 // 업무 화면의 API 조회·초기화가 늦어져도 업데이트 클릭을 연결합니다.
 start();
})();
