(() => {
 'use strict';
 const $=id=>document.getElementById(id),config=window.LOGBOOK_CONFIG||{},key='logbook.instructor.session.v1';
 let token='',expiresAt=0,data=null,busy=false,loading=false;
 const temporaryAccess=true,guideKey='logbook.instructor.selected.v1';let selectedGuide='';
 let preview=false;
 function openPreview(){
  preview=true;selectedGuide='';
  data={instructor:{unit:'1',name:'예시 지도생도'},status:'준비',people:Array.from({length:8},(_,i)=>({id:'preview-'+i,name:'예비생도 '+(i+1),cohort:'00',cadetNumber:'예시 '+String(i+1).padStart(2,'0')})),assets:[],requests:[]};
  for(const [i,p] of data.people.entries())data.assets.push(
   {id:p.id+'-uniform',personId:p.id,kind:'피복',itemName:'전투복 상의',value:'100',quantity:'2',status:'정상',detail:''},
   {id:p.id+'-boots',personId:p.id,kind:'피복',itemName:'전투화',value:'270',quantity:'1',status:i===0?'사용 불가':'정상',detail:i===0?'사이즈 변경 필요':''},
   {id:p.id+'-bag',personId:p.id,kind:'군수품',itemName:'배낭',quantity:'1',status:i===1?'수리 필요':'정상',detail:i===1?'지퍼 불량':''});
  data.requests=[{id:'preview-request',personId:'preview-1',itemName:'배낭',status:'대기',reason:'지퍼 수리 요청 (예시)'}];
  $('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('logout').textContent='실제 명단 선택';$('retry').hidden=true;
  $('people').hidden=false;$('requests').hidden=true;$('peopleTab').setAttribute('aria-pressed','true');$('requestsTab').setAttribute('aria-pressed','false');
  render();$('people').querySelector('details')?.setAttribute('open','');
  $('message').textContent='미리보기 · 예시 자료입니다. 입력 내용은 실제 시트에 저장되지 않습니다.';
 }
 async function temporaryRequest(method,args=[]){
  const response=await fetch(config.apiUrl.replace(/\/$/,'')+'/instructor/temporary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(90000)});
  const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||'연결을 확인하고 다시 시도하세요.');return body.result;
 }
 async function openTemporary(){
  preview=false;$('logout').textContent='지도생도 변경';
  selectedGuide='';data=null;$('workspace').hidden=true;$('logout').hidden=true;$('login').hidden=false;$('retry').hidden=true;
  $('login').innerHTML='<h2>지도생도 선택</h2><p>훈련 준비 기간 · 인증 없이 이용</p><button id="previewGuide">예시 화면 보기</button><label>지도생도<select id="guideSelect"><option value="">불러오는 중…</option></select></label><button id="enterGuide" class="primary" disabled>열기</button>';
  $('previewGuide').onclick=openPreview;
  try{
   const guides=await temporaryRequest('list');
   if(preview)return;
   $('guideSelect').innerHTML='<option value="">'+(guides.length?'지도생도를 선택하세요':'등록된 지도생도가 없습니다')+'</option>'+guides.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.unit+'중대 · '+p.cohort+'기 · '+p.name)+'</option>').join('');
   try{const saved=localStorage.getItem(guideKey);if(guides.some(p=>p.id===saved))$('guideSelect').value=saved;}catch{}
   $('enterGuide').disabled=!$('guideSelect').value;
   $('guideSelect').onchange=()=>{$('enterGuide').disabled=!$('guideSelect').value;};
   $('enterGuide').onclick=()=>{selectedGuide=$('guideSelect').value;try{localStorage.setItem(guideKey,selectedGuide);}catch{}load();};
   $('message').textContent=guides.length?'':'업무일지의 지도생도 편성에서 인원을 먼저 등록하세요.';
  }catch(e){if(preview)return;$('message').textContent=e.message;$('retry').hidden=false;}
 }
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function clearSession(){token='';expiresAt=0;data=null;try{localStorage.removeItem(key);}catch{}$('workspace').hidden=true;$('logout').hidden=true;$('login').hidden=false;$('people').replaceChildren();$('requests').replaceChildren();}
 async function request(path,method,args=[]){
  const response=await fetch(config.apiUrl.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({method,args}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(90000)});
  const body=await response.json();if(response.status===401||response.status===403){clearSession();initGoogle();}
  if(!response.ok||!body.ok)throw Error(body.error||'연결을 확인하고 다시 시도하세요.');return body.result;
 }
 async function rpc(method,args=[]){if(temporaryAccess){if(!selectedGuide)throw Error('지도생도를 선택하세요.');return temporaryRequest(method==='getInstructorWorkspaceV489'?'get':'submit',[selectedGuide,...args]);}if(!token||expiresAt<=Date.now()){clearSession();initGoogle();throw Error('로그인 유지 기간이 만료됐습니다. 다시 인증하세요.');}return request('/rpc',method,args);}
 function render(){
  $('identity').textContent=data.instructor.unit+'중대 · '+data.instructor.name+' · 담당 '+data.people.length+'명';
  $('people').innerHTML=data.people.length?data.people.map(p=>{
   const rows=data.assets.filter(a=>a.personId===p.id);
   return '<details><summary>'+esc(p.name)+'<small>'+esc(p.cohort)+'기 · '+esc(p.cadetNumber||'교번 미등록')+'</small></summary><div class="scroll"><table><thead><tr><th>품목</th><th>상태</th><th>세부사항</th><th></th></tr></thead><tbody>'+rows.map(a=>'<tr><td>'+esc(a.itemName)+'<small> · '+esc(a.kind)+'</small></td><td class="'+(a.status!=='정상'?'bad':'')+'">'+esc(a.status)+'</td><td>'+esc([a.value,a.quantity&&a.quantity+'개',a.detail].filter(Boolean).join(' · ')||'—')+'</td><td><button data-asset="'+esc(a.id)+'">수정 요청</button></td></tr>').join('')+'</tbody></table></div>'+(!rows.length?'<p class="empty">등록된 물품이 없습니다.</p>':'')+'<div class="actions"><button data-person="'+esc(p.id)+'">물품 추가 요청</button></div></details>';
  }).join(''):'<p class="card empty">담당 예비생도가 아직 배정되지 않았습니다.</p>';
  $('requests').innerHTML=data.requests.length?data.requests.map(r=>'<article class="card"><b>'+esc(data.people.find(p=>p.id===r.personId)?.name||'')+' · '+esc(r.itemName)+'</b><p class="request-status">'+esc(r.status)+'</p><p>'+esc(r.reason)+'</p>'+(r.resolution?'<p>처리 내용 · '+esc(r.resolution)+'</p>':'')+'</article>').join(''):'<p class="card empty">등록한 수정 요청이 없습니다.</p>';
  $('people').querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>openRequest(data.assets.find(a=>a.id===b.dataset.asset)));
  $('people').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>openRequest({personId:b.dataset.person}));
 }
 async function load(){
  if(preview){render();return;}
  if(loading)return;loading=true;$('refresh').disabled=true;$('retry').hidden=true;$('message').textContent='담당 자료를 불러오는 중…';
  try{data=await rpc('getInstructorWorkspaceV489');$('workspace').hidden=false;$('logout').hidden=false;$('login').hidden=true;render();$('message').textContent='';}
  catch(e){$('workspace').hidden=true;$('message').textContent=e.message;$('retry').hidden=false;if(token)$('logout').hidden=false;}
  finally{loading=false;$('refresh').disabled=false;}
 }
 function openRequest(asset){
  if(data.status==='이관완료'){$('message').textContent='훈련이 종료되어 수정 요청을 등록할 수 없습니다.';return;}
  $('requestForm').reset();$('personId').value=asset.personId;$('kind').value=asset.kind||'군수품';$('itemName').value=asset.itemName||'';$('kind').disabled=!!asset.id;$('itemName').readOnly=!!asset.id;
  $('value').value=asset.value||'';$('quantity').value=asset.quantity||'';$('condition').value=asset.status||'정상';$('detail').value=asset.detail||'';
  $('requestTitle').textContent=(data.people.find(p=>p.id===asset.personId)?.name||'')+' · 수정 요청';$('requestMessage').textContent='';$('requestDialog').showModal();
 }
 $('requestForm').onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;$('send').disabled=true;$('cancel').disabled=true;
  const input={personId:$('personId').value,kind:$('kind').value,itemName:$('itemName').value,value:$('value').value,quantity:$('quantity').value,status:$('condition').value,detail:$('detail').value,reason:$('reason').value};
  try{if(preview){data.requests.unshift({...input,id:'preview-request-'+Date.now(),status:'대기'});$('requestDialog').close();render();$('message').textContent='미리보기 요청을 추가했습니다. 실제 시트에는 저장되지 않습니다.';}else{await rpc('submitInstructorRequestV489',[input]);$('requestDialog').close();await load();$('message').textContent='수정 요청을 등록했습니다. 관리자 확인 후 반영됩니다.';}}
  catch(e){$('requestMessage').textContent=e.message+' · 다시 보내기 전 수정 요청 목록을 확인하세요.';}
  finally{busy=false;$('send').disabled=false;$('cancel').disabled=false;}
 };
 $('cancel').onclick=()=>$('requestDialog').close();$('requestDialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('refresh').onclick=load;$('retry').onclick=()=>temporaryAccess?(selectedGuide?load():openTemporary()):token?load():location.reload();
 for(const name of ['people','requests'])$(name+'Tab').onclick=()=>{for(const tab of ['people','requests']){$(tab).hidden=tab!==name;$(tab+'Tab').setAttribute('aria-pressed',String(tab===name));}};
 $('logout').onclick=async()=>{if(busy)return;if(temporaryAccess){await openTemporary();return;}try{await request('/logout','logout');clearSession();initGoogle();$('message').textContent='로그아웃했습니다.';}catch(e){$('message').textContent=e.message;}};
 async function credential(response){
  if(busy)return;busy=true;$('message').textContent='이메일 인증 중…';
  try{token=response.credential;const session=await request('/session','login');token=session.token;expiresAt=session.expiresAt;if(!token?.startsWith('session.')||!Number.isFinite(expiresAt))throw Error('인증 응답을 확인할 수 없습니다.');try{localStorage.setItem(key,JSON.stringify({token,expiresAt}));}catch{}await load();}
  catch(e){clearSession();$('message').textContent=e.message;}finally{busy=false;}
 }
 function initGoogle(attempt=0){if(!window.google?.accounts?.id){if(attempt<150)setTimeout(()=>initGoogle(attempt+1),100);else $('message').textContent='로그인 버튼을 불러오지 못했습니다. 새로고침하세요.';return;}google.accounts.id.initialize({client_id:config.googleClientId,callback:credential,auto_select:false});$('googleButton').replaceChildren();google.accounts.id.renderButton($('googleButton'),{theme:'filled_blue',size:'large',text:'continue_with',locale:'ko'});}
 if(temporaryAccess){openPreview();return;}
 if(!config.apiUrl||!config.googleClientId){$('message').textContent='앱 연결 설정을 확인하세요.';return;}
 const googleScript=document.createElement('script');googleScript.src='https://accounts.google.com/gsi/client';googleScript.async=true;document.head.append(googleScript);
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.token?.startsWith('session.')&&saved.expiresAt>Date.now()){token=saved.token;expiresAt=saved.expiresAt;}}catch{}
 if(token){$('login').hidden=true;load();}else initGoogle();
})();
