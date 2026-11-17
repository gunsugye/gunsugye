(() => {
 'use strict';
 const $=id=>document.getElementById(id),config=window.LOGBOOK_CONFIG||{},key='logbook.instructor.session.v1';
 let token='',expiresAt=0,data=null,busy=false,loading=false;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function clearSession(){token='';expiresAt=0;data=null;try{localStorage.removeItem(key);}catch{}$('workspace').hidden=true;$('logout').hidden=true;$('login').hidden=false;$('people').replaceChildren();$('requests').replaceChildren();}
 async function request(path,method,args=[]){
  const response=await fetch(config.apiUrl.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({method,args}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(90000)});
  const body=await response.json();if(response.status===401||response.status===403){clearSession();initGoogle();}
  if(!response.ok||!body.ok)throw Error(body.error||'연결을 확인하고 다시 시도하세요.');return body.result;
 }
 async function rpc(method,args=[]){if(!token||expiresAt<=Date.now()){clearSession();initGoogle();throw Error('로그인 유지 기간이 만료됐습니다. 다시 인증하세요.');}return request('/rpc',method,args);}
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
  try{await rpc('submitInstructorRequestV489',[input]);$('requestDialog').close();await load();$('message').textContent='수정 요청을 등록했습니다. 관리자 확인 후 반영됩니다.';}
  catch(e){$('requestMessage').textContent=e.message+' · 다시 보내기 전 수정 요청 목록을 확인하세요.';}
  finally{busy=false;$('send').disabled=false;$('cancel').disabled=false;}
 };
 $('cancel').onclick=()=>$('requestDialog').close();$('requestDialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('refresh').onclick=load;$('retry').onclick=()=>token?load():location.reload();
 for(const name of ['people','requests'])$(name+'Tab').onclick=()=>{for(const tab of ['people','requests']){$(tab).hidden=tab!==name;$(tab+'Tab').setAttribute('aria-pressed',String(tab===name));}};
 $('logout').onclick=async()=>{if(busy)return;try{await request('/logout','logout');clearSession();initGoogle();$('message').textContent='로그아웃했습니다.';}catch(e){$('message').textContent=e.message;}};
 async function credential(response){
  if(busy)return;busy=true;$('message').textContent='이메일 인증 중…';
  try{token=response.credential;const session=await request('/session','login');token=session.token;expiresAt=session.expiresAt;if(!token?.startsWith('session.')||!Number.isFinite(expiresAt))throw Error('인증 응답을 확인할 수 없습니다.');try{localStorage.setItem(key,JSON.stringify({token,expiresAt}));}catch{}await load();}
  catch(e){clearSession();$('message').textContent=e.message;}finally{busy=false;}
 }
 function initGoogle(attempt=0){if(!window.google?.accounts?.id){if(attempt<150)setTimeout(()=>initGoogle(attempt+1),100);else $('message').textContent='로그인 버튼을 불러오지 못했습니다. 새로고침하세요.';return;}google.accounts.id.initialize({client_id:config.googleClientId,callback:credential,auto_select:false});$('googleButton').replaceChildren();google.accounts.id.renderButton($('googleButton'),{theme:'filled_blue',size:'large',text:'continue_with',locale:'ko'});}
 if(!config.apiUrl||!config.googleClientId){$('message').textContent='앱 연결 설정을 확인하세요.';return;}
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.token?.startsWith('session.')&&saved.expiresAt>Date.now()){token=saved.token;expiresAt=saved.expiresAt;}}catch{}
 if(token){$('login').hidden=true;load();}else initGoogle();
})();
