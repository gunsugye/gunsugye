import {googleLogin} from './google-login.mjs';
import {menuFor,menus} from './model.mjs';
import {modules,moduleFor} from './modules.mjs';
import {RecordStore} from './store.mjs';
import {client,currentMember} from './client.mjs';
import {inventoryPage,armoryPage} from './inventory.mjs';
import {reviewPage,surveyPage} from './reviews.mjs';
import {dutiesPage,occupancyPage,interfacePage,permissionsPage,journalOverview,missingPage} from './management.mjs';
import {trainingStaff,mentorAssignments} from './training.mjs';
import {setting} from './data.mjs';
import {editMenu} from './menu-editor.mjs';
const nav=document.querySelector('#navigation'),content=document.querySelector('#content'),title=document.querySelector('#title'),notice=document.querySelector('.notice');
const store=new RecordStore(client);let mode='semester',member=null,pageName='일자별 업무일지',generation=0,menuConfig=null;
const editable=()=>member&&['admin','editor'].includes(member.role);
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function button(label,action,className='action'){const n=el('button',label,className);n.type='button';n.onclick=async()=>{try{await action();}catch(e){message(errorText(e));}};return n;}
function message(text){notice.textContent=text;}
function errorText(error){return error?.message||'서버 연결을 확인해 주세요.';}
function renderMenu(){
 nav.replaceChildren();for(const group of menuConfig?.value?.[mode]||menuFor(mode)){const section=el('details');section.open=group.title==='업무일지';section.append(el('summary',group.title));
  for(const page of group.items){const b=button(page,()=>show(page),'');b.dataset.page=page;section.append(b);}nav.append(section);
 }
 document.querySelectorAll('[data-mode]').forEach(b=>{b.disabled=member?.role==='company'&&b.dataset.mode==='training';b.classList.toggle('selected',b.dataset.mode===mode);});
}
async function show(name){
 pageName=name;const current=++generation;title.textContent=name;content.replaceChildren();nav.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
 const panel=el('section',undefined,'panel');content.append(panel);
 if(!member){panel.append(el('p','로그인 후 권한에 맞는 기록을 불러옵니다.','empty'));return;}
 const ctx={mode,member,editable:editable(),reload:()=>show(name)};
 const inventorySection={'군수품 관리 현황':'supplies','생활실 비품 관리':'assets','공용비품 현황':'shared','예도 관리':'saber','예도 대여':'saber','흉장·블럭·명패·아크릴판':'duty','피복 사이즈표':'uniform'}[name];
 const reviewSection={'총기 수정 요청':'firearm','군수품 수정 요청':'supplies','근무생도 물품 수정 요청':'duty','예도 수정 요청':'saber','피복 사이즈 수정 요청':'uniform','생활실 비품 수정 요청':'assets'}[name];
 const custom={'근무생도 명단':dutiesPage,'군수계 명단':dutiesPage,'지도생도 편성':trainingStaff,'지도생도·예비생도 배정':mentorAssignments,'생활실 인원 현황':occupancyPage,'인터페이스 관리':interfacePage,'권한 관리':permissionsPage,'업무 통계':journalOverview,'캘린더':(p,c)=>journalOverview(p,c,true),'누락자 명단':missingPage}[name];
 if(custom){try{await custom(panel,ctx);}catch(e){panel.append(el('p',errorText(e),'error'));}return;}
 try{if(inventorySection){await inventoryPage(panel,ctx,inventorySection);return;}if(reviewSection){await reviewPage(panel,ctx,reviewSection);return;}if(name==='전수조사 기록'){await surveyPage(panel,ctx);return;}if(name==='총기 관리 현황'){await armoryPage(panel,ctx);return;}}catch(e){panel.append(el('p',errorText(e),'error'));return;}
 const kind=moduleFor(name);if(!kind){panel.append(el('p','이 메뉴는 새 구조로 전환 중입니다. 아직 조회·저장할 수 없습니다.','empty'));return;}
 const config=modules[kind],toolbar=el('div',undefined,'toolbar'),filters=el('div',undefined,'filters'),actions=el('div',undefined,'actions');
 const company=el('select');company.setAttribute('aria-label','중대 필터');company.append(new Option('전체 중대',''));
 for(let i=1;i<=8;i++)company.append(new Option(`${i}중대`,i));
 if(member.role==='company'){company.value=String(member.company);company.disabled=true;}
 filters.append(company);const status=el('select');status.setAttribute('aria-label','상태 필터');status.append(new Option('전체 상태',''));
 const stateField=config.fields.find(f=>f.key==='status');if(stateField){for(const s of stateField.options)status.append(new Option(s,s));filters.append(status);}
 let page=0;const reload=button('다시 읽기',()=>load());actions.append(reload);if(editable())actions.append(button('추가',()=>edit(kind,null,load),'action primary'));
 toolbar.append(filters,actions);const results=el('div'),pager=el('div',undefined,'pager');panel.append(toolbar,results,pager);let request=0;
 async function load(){const attempt=++request;results.replaceChildren(el('p','기록을 불러오는 중입니다.','empty'));pager.replaceChildren();reload.disabled=true;
  try{const result=await store.list(kind,{mode,company:company.value,status:status.value,page});if(current!==generation||attempt!==request)return;
   results.replaceChildren();if(!result.rows.length)results.append(el('p','등록된 기록이 없습니다.','empty'));
   else{const wrap=el('div',undefined,'table-wrap'),table=el('table'),head=el('thead'),hr=el('tr');for(const f of config.fields)hr.append(el('th',f.label));hr.append(el('th','열기'));head.append(hr);table.append(head);const body=el('tbody');
    for(const row of result.rows){const tr=el('tr');for(const f of config.fields){const td=el('td',String(row[f.key]??'—'));if(f.key==='status')td.className='state';tr.append(td);}const td=el('td');td.append(button(editable()?'수정':'확인',()=>edit(kind,row,load)));tr.append(td);body.append(tr);}table.append(body);wrap.append(table);results.append(wrap);}
   const prev=button('이전',()=>{page--;load();});prev.disabled=page===0;const next=button('다음',()=>{page++;load();});next.disabled=!result.more;pager.append(prev,el('span',`${page+1}페이지 · ${result.rows.length}건`),next);
  }catch(e){if(current===generation&&attempt===request)results.replaceChildren(el('p',errorText(e),'error'));}finally{if(attempt===request)reload.disabled=false;}
 }
 company.onchange=status.onchange=()=>{page=0;load();};await load();
}
function edit(kind,record,onSaved){
 const dialog=el('dialog'),form=el('form'),fields=el('div',undefined,'form-grid'),feedback=el('p',undefined,'error'),footer=el('div',undefined,'dialog-actions');
 form.append(el('h2',`${modules[kind].label} ${record?'기록':'추가'}`),fields,feedback,footer);dialog.append(form);document.body.append(dialog);const writable=editable(),inputs={};
 const defaults={work_date:new Date().toLocaleDateString('sv-SE'),category:'일반',status:kind==='people'?'재학':'진행 중',capacity:2,floor:1};
 for(const f of modules[kind].fields){const label=el('label',f.label);let input;
  if(f.type==='select'){input=el('select');input.append(new Option('선택',''));for(const o of f.options)input.append(new Option(f.key==='company'?`${o}중대`:o,o));}
  else if(f.type==='textarea'){input=el('textarea');input.rows=4;label.className='wide';}
  else{input=el('input');input.type=f.type;}
  input.value=record?.[f.key]??defaults[f.key]??'';input.disabled=!writable;input.name=f.key;inputs[f.key]=input;label.append(input);fields.append(label);
 }
 let busy=false;const close=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
 const cancel=button(writable?'취소':'확인',close);let deleteArmed=false;
 if(record&&writable)footer.append(button('삭제',async()=>{
  if(!deleteArmed){deleteArmed=true;feedback.textContent='이 기록을 삭제하려면 삭제를 한 번 더 누르세요.';return;}
  await run(()=>store.remove(kind,record),'삭제했습니다.');
 },'action danger'));
 footer.append(cancel);const save=button('저장',()=>{},'action primary');save.type='submit';if(writable)footer.append(save);
 const id=crypto.randomUUID();
 async function run(operation,done){if(busy)return;busy=true;feedback.textContent='처리 중입니다.';footer.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await operation();busy=false;dialog.close();message(done);await onSaved();}
  catch(e){feedback.textContent=errorText(e)+' 입력값은 보존되었습니다.';}
  finally{busy=false;footer.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 form.onsubmit=e=>{e.preventDefault();if(!writable)return;const values=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value]));values.mode=mode;run(()=>store.save(kind,values,record,id),'저장했습니다.');};dialog.showModal();
}
const account=el('div',undefined,'actions');document.querySelector('header').append(account);
async function boot(){
 message('인증 상태를 확인하는 중입니다.');try{member=await currentMember();if(member?.role==='company')mode='semester';message(member?`${member.email} · ${editable()?'편집 가능':member.company+'중대 열람 전용'} · 새 앱 전용 기록`:'Google 계정으로 로그인하세요. 기존 앱의 인증과 구분됩니다.');}
 catch(e){member=null;message(errorText(e));}
 if(member){try{menuConfig=await setting('admin-menu',menus);}catch(e){message('메뉴 설정 조회 실패: '+errorText(e));}}
 account.replaceChildren();if(member)account.append(button('로그아웃',async()=>{const {error}=await client.auth.signOut();if(error){message(errorText(error));return;}member=null;content.replaceChildren();boot();}));
 else {account.append(button('Google 로그인',googleLogin,'action primary'));account.append(button('인증 초기화',async()=>{await client.auth.signOut({scope:'local'});member=null;content.replaceChildren();boot();}));}
 document.querySelector('.connection').textContent=member?'Supabase 직접 연결':'로그인 필요';renderMenu();show(pageName);
 if(editable())account.append(button('메뉴 구성 편집',()=>editMenu(menuConfig||{id:'admin-menu',value:menus},menus,async()=>{menuConfig=await setting('admin-menu',menus);renderMenu();})));
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(member?.role==='company'&&b.dataset.mode!=='semester')return;mode=b.dataset.mode;renderMenu();show('일자별 업무일지');});
renderMenu();boot();
