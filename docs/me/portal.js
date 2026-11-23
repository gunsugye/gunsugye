const personalSessionStoreV338=function personalSessionStore(getStorage,now=()=>Date.now()){
 const key='logbook.personal.session.v338';
 const valid=s=>s&&typeof s.token==='string'&&/^session\.[\w-]+\.[\w-]+$/.test(s.token)&&s.token.length<16000&&Number.isFinite(s.expiresAt)&&s.expiresAt>now()&&s.expiresAt<=now()+16*60000;
 const clear=()=>{try{getStorage().removeItem(key);}catch(_){}};
 return {clear,read(){try{const s=JSON.parse(getStorage().getItem(key)||'null');if(valid(s))return {token:s.token,expiresAt:s.expiresAt};}catch(_){}clear();return null;},write(s){if(!valid(s)){clear();return false;}try{getStorage().setItem(key,JSON.stringify({token:s.token,expiresAt:s.expiresAt}));return true;}catch(_){return false;}}};
};
const personalAssetHealthV332=function assetRoomHealth(items,records){
 const issues=[];let unknown=0;
 for(const item of items){const rec=records.find(r=>r.itemId===item.id);if(!rec){unknown++;continue;}
  if(rec.slots){for(const slot of rec.slots){const status=String(slot.status||''),level=slot.unavailable||status==='사용 불가'?'red':/수리/.test(status)?'orange':null;if(level)issues.push({itemId:item.id,name:item.name,position:slot.position,level,label:slot.unavailable?'사용 불가':status});if(!status)unknown++;}}
  else{const status=String(rec.status||''),level=status==='사용 불가'?'red':/수리/.test(status)||Number(rec.repair)>0?'orange':null;if(level)issues.push({itemId:item.id,name:item.name,position:'',level,label:status||'수리 필요'});if(!rec.confirmed)unknown++;}
 }
 const level=issues.some(i=>i.level==='red')?'red':issues.length?'orange':unknown||!items.length?'unknown':'blue';
 return {level,issues,unknown,label:level==='red'?'사용 불가':level==='orange'?'수리 필요':level==='unknown'?'미점검':'정상'};
};
(()=>{'use strict';
const $=id=>document.getElementById(id),config=window.LOGBOOK_CONFIG||{};let token='',expiresAt=0,timer,ticket=0,assetItems=[],dirty=false,busy=false,assetSurveyPolicyV416=null;
const sessionStore=personalSessionStoreV338(()=>window.sessionStorage);
function personalAuthModeV423(){return $('authCadetV423').checked?'cadet':'firearm';}
function personalAuthUpdateV423(){const label=personalAuthModeV423()==='cadet'?'교번':'총기번호';$('numberLabelV423').textContent=label;$('number').placeholder=label+' 입력';$('number').value='';}
for(const id of ['authFirearmV423','authCadetV423'])$(id).addEventListener('change',()=>{personalAuthUpdateV423();$('status').textContent='';});
function keepSessionV338(session){if(session.preview)try{sessionStorage.removeItem('logbook.personal.layout.v425');}catch(_){}token=session.token;expiresAt=session.expiresAt;sessionStore.write(session);clearTimeout(timer);timer=setTimeout(()=>clear('인증 시간이 만료되었습니다.'),Math.max(0,expiresAt-Date.now()));}
function clear(message=''){personalSupplyResetV507();personalFirearmResetV413();personalDutyResetV400();uniformEditV350=null;uniformDirtyV350=false;personalCollapsedOverridesV525.clear();personalDeferredDetailsV525=null;sessionStore.clear();try{sessionStorage.removeItem('logbook.personal.layout.v425');sessionStorage.removeItem('logbook.personal.data.v431');}catch(_){}personalLastDataV425=null;ticket++;token='';expiresAt=0;clearTimeout(timer);dirty=false;assetItems=[];$('dashboard').hidden=true;$('login').hidden=false;$('status').textContent=message;$('loginForm').reset();personalAuthUpdateV423();for(const id of ['personName','personMeta','room','firearm','supplies','uniform','assets','warnings','updated'])$(id).replaceChildren();$('assetActions').hidden=true;$('refresh').disabled=false;}
async function request(path,body={}){
 if(!/^https:\/\//.test(config.apiUrl||''))throw Error('조회 연결 설정을 확인하세요.');const saving=['assets','uniform-request','duty-request','firearm-request','supply-request'].includes(path);
 if(saving&&personalSaveFlightV425)throw Error('이미 처리 중입니다. 완료될 때까지 기다려 주세요.');
 if(saving&&personalCompletedPathsV425.has(path))throw Error('이미 저장한 내용입니다. 입력 내용을 변경한 뒤 다시 저장하세요.');
 if(saving){personalSaveFlightV425=true;personalSaveOverlayV425(true);}const requestToken=token;
 try{const response=await fetch(config.apiUrl.replace(/\/$/,'')+'/personal/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(requestToken?{Authorization:'Bearer '+requestToken}:{})},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(90000)});const result=await response.json();if(response.status===401){if(token===requestToken)clear('인증 시간이 만료되었습니다. 다시 인증하세요.');throw Error('인증 시간이 만료되었습니다.');}if(!result.ok)throw Error(result.error||'조회에 실패했습니다.');if(saving&&result.result?.direct&&token===requestToken)personalSaveDoneV425(path);return result.result;
 }catch(error){if(saving&&['TimeoutError','AbortError','TypeError'].includes(error.name))throw Error('저장 응답을 확인하지 못했습니다. 중복 저장을 피하려면 새로고침으로 반영 여부를 먼저 확인하세요.');throw error;}finally{if(saving){personalSaveFlightV425=false;personalSaveOverlayV425(false);}}
}
function element(tag,text,cls){const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;}
function plainFields(id,values){const root=$(id);root.replaceChildren();const entries=Object.entries(values||{}).filter(([,v])=>v!==''&&v!==null&&v!==undefined);if(!entries.length){root.append(element('p','기록 없음','empty'));return;}for(const [label,value] of entries){const row=document.createElement('div');row.append(element('dt',label),element('dd',String(value)));root.append(row);}}
function renderAssets(data,loading){assetSurveyPolicyV416=data?.policy||null;const direct=assetSurveyPolicyV416?.mode==='direct';assetItems=data?.items||[];dirty=false;$('assets').replaceChildren();$('assetActions').hidden=!data?.initialized;$('assetStatus').textContent='';$('saveAssets').textContent=direct?'전수조사 저장·확인':'비품 수정 요청';$('saveAssets').disabled=!direct;
 if(!assetItems.length){$('assets').append(element('p',loading?'불러오는 중…':data&&!data.initialized?'관리자 비품 설정 필요':'비품 기록 없음','empty'));return;}
 const hint=document.querySelector('#assetForm').previousElementSibling;hint.textContent=(data.position?data.position+'번 자리 · 공용':'공용 비품')+(direct?' · 전수조사 기간 · 저장 즉시 반영 및 기록 보관':' · 관리자 확인 후 반영');
 if(data.requests?.length){const history=document.createElement('details');history.className='personal-requests';history.append(element('summary','수정 요청 · 대기 '+data.requests.filter(r=>r.status==='대기').length+'건'));for(const r of data.requests)history.append(element('p',r.createdAt.slice(0,10)+' · '+r.status+(r.note?' · '+r.note:'')));$('assets').append(history);}
 const table=personalTableV335('생활실 비품');$('assets').append(table);
 for(const item of assetItems){const details=document.createElement('tbody');details.className='asset-item';
 for(const slot of item.slots){if(slot.unavailable)slot.status='사용 불가';slot.unavailable=slot.status==='사용 불가';}item.original=JSON.stringify(item.slots);
 for(const [index,slot] of item.slots.entries()){const row=element('tr','','asset-slot');if(index===0){const name=element('th',item.name);name.scope='rowgroup';name.rowSpan=item.slots.length;if(slot.position==='common')name.append(element('small','공용','asset-common'));row.append(name);}const state=document.createElement('td');state.append(element('strong',slot.position==='common'?'공용':slot.position+'번'));const label=element('label',''),select=document.createElement('select');select.setAttribute('aria-label',item.name+' '+slot.position+' 상태');for(const value of ['','정상','수리 필요','사용 불가']){const option=element('option',({'수리 필요':'수리 필요','사용 불가':'사용 불가'})[value]||value||'미점검');option.value=value;select.append(option);}select.value=/수리/.test(slot.status||'')?'수리 필요':slot.status||'';const display=element('span',/수리/.test(select.value)?'수리필요\n(보고완료)':select.selectedOptions[0]?.textContent||'미점검','personal-state-label');display.setAttribute('aria-hidden','true');select.addEventListener('change',()=>{slot.status=select.value;slot.unavailable=select.value==='사용 불가';display.textContent=/수리/.test(select.value)?'수리필요\n(보고완료)':select.selectedOptions[0]?.textContent||'미점검';changed();});label.className='personal-state-select';label.append(select,display);state.append(label);
 row.append(state);
 const note=document.createElement('td'),textarea=document.createElement('textarea');textarea.setAttribute('aria-label',item.name+' '+slot.position+' 세부사항');textarea.maxLength=500;textarea.rows=1;textarea.value=slot.details||'';textarea.placeholder='—';textarea.addEventListener('input',()=>{slot.details=textarea.value;slot.status=select.value;changed();});note.append(textarea);if(index===0&&item.legacy){const legacy=element('details','','legacy-note');legacy.append(element('summary','이전 기록'),element('p',[item.legacy.status,item.legacy.details].filter(Boolean).join(' · ')));note.append(legacy);}row.append(note);details.append(row);}
 details.dataset.personalItem=item.id;table.append(details);}personalPlanRenderV332();}
function personalTableV335(caption){const table=element('table','','personal-table');table.append(element('caption',caption,'sr-only'));const cols=document.createElement('colgroup');for(const cls of ['item-col','status-col','detail-col'])cols.append(element('col','',cls));table.append(cols);const head=document.createElement('thead'),row=document.createElement('tr');for(const text of ['품목','상태','세부사항']){const th=element('th',text);th.scope='col';row.append(th);}head.append(row);table.append(head);return table;}
function supplyAttentionV523(item,key,value){
 const text=String(value??'').trim();if(!text)return '';
 if(text==='무'&&item.schema?.options?.[key]?.includes('유'))return 'absent';
 const max=key==='수량'?item.quantityRange?.max??item.schema?.quantityRange?.max:item.schema?.numeric?.[key];
 return Number.isFinite(Number(max))&&Number(max)>0&&/^\d+$/.test(text)&&Number(text)<Number(max)?'shortage':'';
}
function supplyRenderAlertsV523(){
 const root=document.getElementById('supplyRows');if(!root||typeof supplyItem==='undefined'||!supplyItem)return;
 for(const input of root.querySelectorAll('[data-supply-field^="extra:"]')){
  const key=input.dataset.supplyField.slice(6),attention=supplyAttentionV523(supplyItem,key,input.value),cell=input.closest('td');
  if(cell)cell.dataset.supplyAttention=attention;
 }
}
document.addEventListener('change',event=>{
 const input=event.target.closest?.('#supplyRows [data-supply-field^="extra:"]');if(!input||typeof supplyItem==='undefined'||!supplyItem)return;
 const cell=input.closest('td');if(cell)cell.dataset.supplyAttention=supplyAttentionV523(supplyItem,input.dataset.supplyField.slice(6),input.value);
});
function supplyRequestShortcutV524(){
 const header=document.getElementById('supplySelectedName')?.closest('.panel-head');if(!header||header.querySelector('[data-supply-request-shortcut]'))return;
 const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.supplyRequestShortcut='';button.textContent='군수품 수정 요청';button.onclick=()=>switchView('supplyRequests');header.append(button);
}

function supplyFieldLabelV509(key){return key==='정화통위치'?'정화통 위치':key;}
function supplyItemNameV517(item){const position=item.fields?.정화통위치;return /방독면/.test(item.name)&&['좌','우'].includes(position)?item.name.replace(/\([좌우]\)$/,'')+'('+position+')':item.name;}
let personalSupplyDirtyV506=false,personalSupplyModelV507=null;
function personalSupplyResetV507(){personalSupplyActionsV518(true);personalSupplyDirtyV506=false;personalSupplyModelV507=null;document.querySelectorAll('.personal-supply-dialog-v507').forEach(dialog=>dialog.close());}
function supplyMissingV507(item,value){
 const keys=['수량',...(item.schema?.fields||Object.keys(item.fields||{}).filter(k=>k!=='수량'))],missing=[];
 for(const key of keys)if(String(value.extra?.[key]??'').trim()===''&&(key==='수량'||String(value.extra?.수량)!=='0'))missing.push(supplyFieldLabelV509(key));
 if(item.schema?.includeStatus!==false&&String(value.extra?.수량)!=='0'&&!value.status)missing.push('상태');
 return missing;
}
function supplyCompletionV507(item,value){const filled=!!(value.status||value.detail.trim()||Object.values(value.extra||{}).some(v=>String(v).trim()!==''));return !filled?'empty':supplyMissingV507(item,value).length?'partial':'complete';}
function supplyDraftV507(item){return JSON.parse(JSON.stringify(item.pending?.snapshot===item.snapshot&&item.policy?.mode!=='direct'?item.pending.value:{status:item.status||'',detail:item.detail||'',extra:{...item.fields}}));}
function supplyDialogV507(title){const dialog=element('dialog');dialog.className='personal-supply-dialog-v507';dialog.append(element('h2',title));document.body.append(dialog);dialog.onclose=()=>dialog.remove();const close=dialog.close.bind(dialog);dialog.close=()=>{close();dialog.remove();};return dialog;}
function supplyDraftValidV507(value){const qty=String(value.extra?.수량??'');return qty===''||/^\d+$/.test(qty)&&Number.isSafeInteger(Number(qty))&&Number(qty)<=100000;}
function personalSupplyPopupV507(entry){
 const model=personalSupplyModelV507;if(!model||busy||model.loading)return;const dialog=supplyDialogV507(entry.item.name),form=element('form'),readers={};form.className='personal-supply-popup-fields-v507';
 const value=JSON.parse(JSON.stringify(entry.value)),keys=['수량',...(entry.item.schema?.fields||Object.keys(entry.item.fields||{}).filter(k=>k!=='수량'))];
 for(const key of keys){const label=element('label',supplyFieldLabelV509(key)),input=element('input'),current=String(value.extra?.[key]??''),numeric=Object.hasOwn(entry.item.schema?.numeric||{},key),options=numeric?Array.from({length:entry.item.schema.numeric[key]+1},(_,i)=>String(i)):key==='정화통위치'?['좌','우']:key==='수량'?Array.from({length:(entry.item.quantityRange?.max??1)+1},(_,i)=>String(i)):entry.item.choiceOptions?.[key]||entry.item.schema?.options?.[key]||(['좌','우'].includes(key)?entry.item.schema?.options?.사이즈:[])||[];input.value=current;input.maxLength=500;input.setAttribute('aria-label',entry.item.name+' '+key);
  if(key==='수량'||numeric){if(key==='수량')label.append(element('small','기준 '+(entry.item.quantityRange?.standard??Math.min(1,entry.item.quantityRange?.max??1))+'개'));input.type='number';input.min='0';input.max='100000';input.step='1';}
  if(options.length||['사이즈','좌','우'].includes(key)){if((!entry.item.schema?.preset||numeric||key==='수량')&&key!=='정화통위치'&&current&&!options.includes(current))options.push(current);const select=element('select');select.setAttribute('aria-label',entry.item.name+' '+key+' 선택');for(const optionValue of ['',...options,...(key==='정화통위치'||entry.item.schema?.preset&&!numeric&&key!=='수량'?[]:['__direct'])]){const option=element('option',optionValue==='__direct'?'직접 입력':optionValue===''?'미입력':optionValue);option.value=optionValue;select.append(option);}select.value=current===''?'':options.includes(current)?current:'__direct';input.hidden=select.value!=='__direct';input.disabled=input.hidden;select.onchange=()=>{input.hidden=select.value!=='__direct';input.disabled=input.hidden;if(input.hidden)input.value=select.value;else input.focus();};label.append(select,input);readers[key]=()=>select.value==='__direct'?input.value:select.value;
  }else{label.append(input);readers[key]=()=>input.value;}form.append(label);
 }
 const stateLabel=element('label','상태'),select=element('select');select.setAttribute('aria-label',entry.item.name+' 상태');for(const state of ['','정상','수리 필요','사용 불가']){const option=element('option',state||'미입력');option.value=state;select.append(option);}select.value=value.status;stateLabel.append(select);
 const detailLabel=element('label','세부사항'),note=element('textarea');note.value=value.detail;note.rows=3;note.maxLength=3000;note.placeholder='정상은 생략 가능';note.setAttribute('aria-label',entry.item.name+' 세부사항');detailLabel.append(note);
 const message=element('p','','hint');message.setAttribute('role','status');const actions=element('div','','personal-supply-actions-v507'),cancel=element('button','취소'),apply=element('button','작성 완료');cancel.type='button';apply.type='submit';cancel.onclick=()=>dialog.close();actions.append(cancel,apply);if(entry.item.schema?.includeStatus!==false)form.insertBefore(stateLabel,form.children[1]||null);form.append(detailLabel,message,actions);dialog.append(form);
 form.onsubmit=event=>{event.preventDefault();const next={status:select.value,detail:note.value.trim(),extra:Object.fromEntries(Object.entries(readers).map(([key,read])=>[key,read().trim()]))};if(!supplyDraftValidV507(next)){message.textContent='수량은 0~100,000 사이 정수로 입력하세요.';return;}
  if(JSON.stringify(next)!==JSON.stringify(entry.value)){entry.value=next;model.notice='작성 내용은 마지막에 한 번에 제출합니다.';}personalSupplyDirtyV506=model.entries.some(e=>JSON.stringify(e.value)!==JSON.stringify(e.baseline));dialog.close();personalSupplyDrawV507();
 };dialog.showModal();
}
function personalSupplyReviewV507(){
 const model=personalSupplyModelV507;if(!model||model.loading||busy)return;const dialog=supplyDialogV507(model.direct?'저장 내용 확인':'수정 요청 확인'),list=element('div','','personal-supply-review-v507');
 for(const entry of model.entries){const section=element('section'),missing=supplyMissingV507(entry.item,entry.value),table=element('table','','personal-supply-review-table-v510');section.append(element('strong',entry.item.name));for(const [key,value] of supplyDisplayValuesV521(entry)){const row=element('tr'),label=element('th',supplyFieldLabelV509(key));label.scope='row';row.append(label,element('td',value||'미입력'));table.append(row);}section.append(table);if(missing.length)section.append(element('small',missing.join('·')+' 미작성'));list.append(section);}dialog.append(list);
 const message=element('p','','hint');message.setAttribute('role','status');const actions=element('div','','personal-supply-actions-v507'),cancel=element('button','취소'),confirm=element('button','확인');cancel.type=confirm.type='button';cancel.onclick=()=>dialog.close();actions.append(cancel,confirm);dialog.append(message,actions);let submitting=false;dialog.addEventListener('cancel',event=>{if(submitting)event.preventDefault();});
 confirm.onclick=async()=>{if(submitting||busy||!token)return;submitting=true;busy=true;dialog.inert=true;$('refresh').disabled=true;const generation=ticket;message.textContent=model.direct?'저장 중…':'요청 중…';
  try{const payload={changes:model.entries.map(entry=>({itemId:entry.item.id,snapshot:entry.item.snapshot,value:entry.value})),campaignId:model.direct?model.policyId:''};let result;try{result=await request('supply-request',payload);}catch(error){if(!model.direct||!(/서버.*연결|연결 실패|응답 시간|네트워크|network|fetch/i.test(String(error?.message||error))))throw error;message.textContent='저장 결과 확인 중…';result=await request('supply-request',payload);}if(generation!==ticket||!token)return;
   for(const entry of model.entries){const updated=result.items?.find(item=>item.id===entry.item.id);if(updated)entry.item=updated;entry.baseline=JSON.parse(JSON.stringify(entry.value));}personalSupplyDirtyV506=false;model.notice=result.direct?'전수조사 저장 완료':result.results?.some(r=>r.requested)?'수정 요청 접수 · 관리자 확인 대기':result.results?.some(r=>r.cancelled)?'대기 요청 취소 완료':'검토 완료 · 변경한 항목 없음';try{sessionStorage.removeItem(personalDataKeyV431);}catch(_){}dialog.close();personalSupplyDrawV507();
  }catch(error){if(generation===ticket)message.textContent=error.message;}finally{submitting=false;busy=false;dialog.inert=false;if(generation===ticket)$('refresh').disabled=false;}
 };dialog.showModal();
}
function personalSupplyDrawV507(){
 const model=personalSupplyModelV507,root=$('supplies');if(!model)return;root.replaceChildren();const notice=element('p',model.notice||'품목을 눌러 작성한 뒤 한 번에 제출하세요.','hint');notice.setAttribute('role','status');root.append(notice);const legend=element('p','미작성 · 부분작성 · 작성 완료','personal-supply-legend-v507');legend.replaceChildren(...[['empty','미작성'],['partial','부분작성'],['complete','작성 완료']].map(([state,label])=>{const span=element('span',label);span.dataset.supplyCompletion=state;return span;}));root.append(legend);
 const itemButton=entry=>{const missing=supplyMissingV507(entry.item,entry.value),state=supplyCompletionV507(entry.item,entry.value),button=element('button',supplyItemNameV517(entry.item)+(state==='partial'?'('+missing.join('·')+' 미작성)':''),'personal-supply-item-v507');button.type='button';button.dataset.supplyCompletion=state;button.dataset.personalSupplyItem=entry.item.id;button.disabled=model.loading||!entry.item.snapshot;button.onclick=()=>personalSupplyPopupV507(entry);return button;};
 for(const entry of model.entries){const section=element('section','','personal-supply-section-v520'),fields=['수량',...(entry.item.schema?.fields||[])],scroll=element('div','','personal-supply-scroll-v509'),table=element('table','','personal-table personal-supply-table-v509'),head=element('thead'),header=element('tr'),body=element('tbody'),row=element('tr'),name=element('th');name.scope='row';name.append(itemButton(entry));row.append(name);scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',entry.item.name+' 현황 · 좌우 스크롤');table.setAttribute('aria-label',entry.item.name);const values=supplyDisplayValuesV521(entry),labels=['품목',...values.map(([key])=>key)];for(const label of labels){const cell=element('th',supplyFieldLabelV509(label));cell.scope='col';header.append(cell);}head.append(header);for(const [key,value] of values){const cell=element('td',String(value??'').trim()||(key==='세부사항'?'—':'미입력'));if(key==='상태')cell.dataset.supplyStatus='';const attention=supplyAttentionV523(entry.item,key,value);if(attention)cell.dataset.supplyAttention=attention;row.append(cell);}body.append(row);table.append(head,body);scroll.append(table);section.append(scroll);root.append(section);}

 const requestButton=element('button',model.direct?'전수조사 저장':'수정 요청','personal-supply-submit-v507');requestButton.type='button';requestButton.disabled=model.loading||model.entries.some(entry=>!entry.item.snapshot);requestButton.onclick=personalSupplyReviewV507;root.append(requestButton);personalSupplyActionsV518();
}
function renderSuppliesV335(items,loading){personalSupplyDirtyV506=false;const root=$('supplies');if(!items?.length){personalSupplyModelV507=null;personalSupplyActionsV518(true);root.replaceChildren(element('p',loading?'불러오는 중…':'기록 없음','empty'));return;}personalSupplyModelV507={entries:items.map(item=>{const value=supplyDraftV507(item);return {item,value,baseline:JSON.parse(JSON.stringify(value))};}),loading,direct:items.some(item=>item.policy?.mode==='direct'),policyId:items.find(item=>item.policy?.mode==='direct')?.policy.id||'',notice:''};personalSupplyDrawV507();}
window.addEventListener('beforeunload',event=>{if(personalSupplyDirtyV506){event.preventDefault();event.returnValue='';}});

function personalSupplyActionsV518(clear=false){
 const dashboard=$('dashboard');if(!dashboard)return;dashboard.querySelectorAll('[data-personal-batch-v518]').forEach(node=>node.remove());const model=personalSupplyModelV507;if(clear||!model?.entries.length)return;
 const make=()=>{const bar=element('div','','personal-batch-actions-v518'),button=element('button',model.direct?'전수조사 저장':'일괄 수정 요청','personal-supply-submit-v507');bar.dataset.personalBatchV518='';button.type='button';button.disabled=model.loading||model.entries.some(e=>!e.item.snapshot);button.onclick=personalSupplyReviewV507;bar.append(button);return bar;};dashboard.prepend(make());dashboard.append(make());
}

function supplyDisplayValuesV521(entry){return [['수량',entry.value.extra?.수량],...(entry.item.schema?.includeStatus===false?[]:[['상태',entry.value.status]]),...(entry.item.schema?.fields||[]).filter(f=>f!=='수량').map(f=>[f,entry.value.extra?.[f]]),['세부사항',entry.value.detail]];}


function personalPlanRenderV332(){
 $('personalPlanV332')?.remove();if(!assetItems.length)return;
 const records=assetItems.map(i=>i.legacy&&i.slots.every(s=>!s.status&&!s.unavailable&&!s.details)?{itemId:i.id,status:i.legacy.status,confirmed:false}:{itemId:i.id,slots:i.slots});
 const health=personalAssetHealthV332(assetItems,records),plan=element('article','','personal-room-plan asset-plan-card asset-plan-'+health.level);plan.id='personalPlanV332';plan.append(element('strong','내 생활실 · '+health.label));
 for(const issue of health.issues){const button=element('button',issue.name+' · '+(issue.position?(issue.position==='common'?'공용':issue.position+'번'):'기존 기록')+' · '+(/수리/.test(issue.label)?'수리 필요':issue.label),'asset-plan-issue asset-plan-'+issue.level);button.type='button';button.addEventListener('click',()=>{const item=assetItems.find(i=>i.id===issue.itemId),detail=[...document.querySelectorAll('[data-personal-item]')].find(d=>d.dataset.personalItem===issue.itemId);if(!detail)return;const target=detail.querySelectorAll('.asset-slot')[item.slots.findIndex(s=>s.position===issue.position)]||detail;document.querySelectorAll('.asset-plan-target').forEach(n=>n.classList.remove('asset-plan-target'));target.classList.add('asset-plan-target');target.scrollIntoView({behavior:'smooth',block:'center'});target.querySelector('select')?.focus({preventScroll:true});});plan.append(button);}
 if(health.unknown)plan.append(element('small','미점검 '+health.unknown,'asset-plan-pending'));$('assets').prepend(plan);
}
function changed(){dirty=assetItems.some(i=>JSON.stringify(i.slots)!==i.original);$('saveAssets').disabled=(!dirty&&assetSurveyPolicyV416?.mode!=='direct')||busy;$('assetStatus').textContent=dirty?'저장 전':'';personalPlanRenderV332();}
function render(data){personalFirearmRenderV413(data);personalDutyRenderV400(data);personalInterfaceOrderV359(data.interfaceOrder,data.interfaceCollapsed);personalLayoutRememberV425(data);$('login').hidden=true;$('dashboard').hidden=false;$('status').textContent=data.loading?'인증 완료 · 정보 불러오는 중…':'';$('personName').textContent=data.person.name;$('personMeta').textContent=[data.person.cohort?String(data.person.cohort).replace(/기/g,'')+'기':'',data.person.company?String(data.person.company).normalize('NFKC').replace(/중대$/,'')+'중대':'',data.person.cadetNumber?'교번 '+data.person.cadetNumber:''].filter(Boolean).join(' · ');$('room').textContent=data.loading?'불러오는 중…':data.room?[data.room.building,data.room.floor,data.room.room+'호',data.room.position?data.room.position+'번':''].filter(Boolean).join(' · '):'배정 기록 없음';fields('firearm',data.loading?{'조회':'불러오는 중…'}:{'총기번호':data.firearm.number,'상태':data.firearm.status});fields('uniform',(data.loading||data.detailsLoading)?{'조회':'불러오는 중…'}:data.uniform);renderAssets(data.assets,data.loading);renderSuppliesV335(data.supplies,data.loading||data.detailsLoading);$('warnings').hidden=!data.warnings?.length;$('warnings').textContent=(data.warnings||[]).join(' · ');$('updated').textContent='조회 '+new Date(data.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}
async function load(initial){
 const current=++ticket,result={},errors={};personalLoadShellV425();$('refresh').disabled=true;let coreSettled=false;const alive=()=>current===ticket&&token&&Date.now()<expiresAt;
 const warnings=()=>{const messages=[...new Set([...Object.values(result).flatMap(r=>r.warnings||[]),...Object.values(errors)])];$('warnings').hidden=!messages.length;$('warnings').textContent=messages.join(' · ');};
 const shown=new Set(),showDetails=()=>{if(!coreSettled)return;if(result.details){result.uniform=result.details;result.supplies=result.details;}if(errors.details){errors.uniform=errors.details;errors.supplies=errors.details;}for(const part of ['uniform','supplies']){if(shown.has(part)||!result[part]&&!errors[part])continue;shown.add(part);if(result[part]){if(part==='uniform'){uniformEditV350=result.uniform.uniformEdit||null;fields('uniform',result.uniform.uniform);}else renderSuppliesV335(result.supplies.supplies,false);}else if(part==='uniform')fields('uniform',{'조회':'새로고침 필요'});else $('supplies').replaceChildren(element('p','조회 지연 · 새로고침','empty'));personalLoadPartV425(part);}};
 const corePending=initial?Promise.resolve(initial):request('me'),dutyPending=corePending.then(()=>request('duty'));const tasks=[['core',corePending],['duty',dutyPending],...personalDetailTasksV527(corePending)].map(([part,pending])=>pending.then(data=>{if(!alive())return;result[part]=data;if(part==='core'){coreSettled=true;render(data);personalLoadPartV425('core');}else if(part==='duty'){if(result.core){result.core.duty=data.duty;if(data.duty?.isDuty){result.core.interfaceOrder=result.core.dutyInterfaceOrder;result.core.interfaceCollapsed=result.core.dutyInterfaceCollapsed;}personalDutyRenderV400(result.core);personalInterfaceOrderV359(result.core.interfaceOrder,result.core.interfaceCollapsed);}personalLoadPartV425('duty');}showDetails();warnings();}).catch(error=>{if(!alive())return;errors[part]=(part==='core'?'생활실·비품·총기':part==='duty'?'근무생도 물품':part==='uniform'?'피복':'군수품')+' 조회: '+error.message;if(part==='core'){coreSettled=true;$('room').textContent='조회 지연 · 새로고침';personalLoadPartV425('core');}else if(part==='duty')personalLoadPartV425('duty');showDetails();warnings();}));
 await Promise.allSettled(tasks);if(alive()){if(result.core&&result.duty&&result.uniform&&result.supplies)personalDataRememberV431({...result.core,uniform:result.uniform.uniform,supplies:result.supplies.supplies,detailsLoading:false,updatedAt:result.supplies.updatedAt||result.core.updatedAt});$('refresh').disabled=busy;if(Object.keys(errors).length)$('status').textContent='일부 항목 조회 지연 · 새로고침으로 다시 확인하세요.';}
}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('submit').disabled=true;$('submit').textContent='인증 중…';$('status').textContent='명단 확인 중…';try{const authType=personalAuthModeV423(),session=await request('login',{name:$('name').value,...(authType==='cadet'?{authType,cadetNumber:$('number').value}:{firearmNumber:$('number').value})});$('number').value='';keepSessionV338(session);if(session.preview?.loading)render(session.preview);await load(session.preview&&!session.preview.loading?session.preview:null);}catch(error){$('status').textContent=error.name==='TimeoutError'?'연결이 지연됩니다. 다시 시도하세요.':error.message;}finally{$('submit').disabled=false;$('submit').textContent='본인 정보 조회';}});
$('assetForm').addEventListener('submit',async e=>{e.preventDefault();const direct=assetSurveyPolicyV416?.mode==='direct';if(!dirty&&!direct||busy||!token)return;const current=ticket,changes=assetItems.filter(i=>JSON.stringify(i.slots)!==i.original).map(i=>({itemId:i.id,expectedUpdatedAt:i.updatedAt,slots:i.slots}));busy=true;$('saveAssets').disabled=true;$('assetForm').inert=true;$('refresh').disabled=true;$('assetStatus').textContent=direct?'저장 중…':'요청 중…';try{const result=await request('assets',{changes,campaignId:direct?assetSurveyPolicyV416.id:''});if(current!==ticket||!token)return;renderAssets(result.assets,false);$('assetStatus').textContent=result.direct?'전수조사 저장 완료 · 즉시 반영 및 기록 보관':'수정 요청 접수 · 관리자 확인 대기';}catch(error){if(current===ticket)$('assetStatus').textContent=error.message;}finally{busy=false;$('assetForm').inert=false;if(current===ticket){$('refresh').disabled=false;$('saveAssets').disabled=!dirty&&assetSurveyPolicyV416?.mode!=='direct';}}});
$('refresh').addEventListener('click',()=>{if((personalSupplyDirtyV506||dirty||uniformDirtyV350||personalDutyDirtyV400||personalFirearmDirtyV413)&&!confirm('저장하지 않은 변경을 지울까요?'))return;uniformDirtyV350=false;uniformEditV350=null;load().catch(e=>$('status').textContent=e.message);});$('logout').addEventListener('click',async()=>{if((personalSupplyDirtyV506||dirty||uniformDirtyV350||personalDutyDirtyV400||personalFirearmDirtyV413)&&!confirm('저장하지 않은 변경을 지울까요?'))return;const pending=request('logout').catch(()=>{});clear('조회가 종료되었습니다.');await pending;});document.addEventListener('visibilitychange',()=>{if(token&&Date.now()>=expiresAt)clear('인증 시간이 만료되었습니다.');});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
function quantityColorV502(required,quantity){
 if(quantity===null||quantity===undefined||quantity==='')return 'background:#edf0f5!important;color:#526174!important;box-shadow:inset 3px 0 #8895a7';
 const missing=Math.max(0,Number(required)-Number(quantity));if(!missing)return '';
 const level=Math.min(4,Math.ceil(missing)),background=['','#fff4df','#ffe1ab','#ffc875','#ffad42'][level];
 return 'background:'+background+'!important;color:#783b08!important;box-shadow:inset 3px 0 #d97706';
}
function conditionColorV501(value){const text=String(value||'').replace(/\s/g,'');return /^(사용불가|교체필요)$/.test(text)?'unusable':/^수리필요(?:\(.*\))?$/.test(text)?'repair':'';}
function conditionColorsStartV501(){
 let pending=false;
 const render=()=>{pending=false;for(const node of document.querySelectorAll('select,td,dd,span,strong,b')){
  if(node.tagName==='SELECT'&&!Array.from(node.options).some(option=>conditionColorV501(option.value)))continue;
  if(node.tagName!=='SELECT'&&node.children.length)continue;
  const state=conditionColorV501(node.tagName==='SELECT'?node.value:node.textContent);
  if(state){if(node.dataset.conditionColor!==state)node.dataset.conditionColor=state;}
  else if(node.dataset.conditionColor)delete node.dataset.conditionColor;
 }
 for(const row of document.querySelectorAll('tr')){const states=Array.from(row.querySelectorAll('[data-condition-color]')).map(node=>node.dataset.conditionColor),state=states.includes('unusable')?'unusable':states.includes('repair')?'repair':'';if(state){if(row.dataset.conditionColor!==state)row.dataset.conditionColor=state;}else if(row.dataset.conditionColor)delete row.dataset.conditionColor;}
 };
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(render);}};
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});document.addEventListener('change',schedule);render();
}
conditionColorsStartV501();

let personalLastDataV425=null,personalLoadPartsV425=new Set(),personalSaveFlightV425=false,personalOverlayTimerV425=null,personalDeferredDetailsV525=null,personalDeferredDutyV529=null;
const personalLayoutKeyV425='logbook.personal.layout.v425',personalDataKeyV431='logbook.personal.data.v431',personalCompletedPathsV425=new Set();
function personalLayoutReadV425(){try{const value=JSON.parse(sessionStorage.getItem(personalLayoutKeyV425)||'null');if(value&&value.expiresAt>Date.now()&&Array.isArray(value.order))return value;}catch(_){}return null;}
function personalLayoutRememberV425(data){if(!data.loading)personalLastDataV425=data;if(!Array.isArray(data.interfaceOrder))return;try{sessionStorage.setItem(personalLayoutKeyV425,JSON.stringify({order:data.interfaceOrder,collapsed:data.interfaceCollapsed,duty:!!data.duty?.isDuty,expiresAt}));}catch(_){}}
function personalDataReadV431(){try{const value=JSON.parse(sessionStorage.getItem(personalDataKeyV431)||'null');if(value&&value.token===token&&value.expiresAt>Date.now()&&value.data?.person)return value.data;}catch(_){}return null;}
function personalDataRememberV431(data){if(!token||data?.loading)return;personalLastDataV425=data;try{sessionStorage.setItem(personalDataKeyV431,JSON.stringify({token,expiresAt:Math.min(expiresAt,Date.now()+15*60*1000),data}));}catch(_){} }
function personalLoadingCardV425(id,pending){const card=id==='duty'?$('personalDutyV400'):$(id)?.closest('section.card');if(!card)return;card.setAttribute('aria-busy',String(pending));card.inert=false;for(const child of card.children)if(!child.classList.contains('personal-card-header-v525'))child.inert=pending;card.classList.toggle('personal-card-loading-v425',pending);}
function personalLoadShellV425(){personalDeferredDetailsV525=null;personalCompletedPathsV425.clear();document.querySelectorAll('[data-personal-saved]').forEach(card=>delete card.dataset.personalSaved);document.querySelectorAll('[data-save-complete]').forEach(node=>node.remove());const layout=personalLayoutReadV425(),last=personalDataReadV431()||personalLastDataV425;uniformEditV350=null;personalLoadPartsV425.clear();if(last?.person){render(last);$('status').textContent='최근 정보 확인 중…';}else render({person:{name:'내 군수 정보',cohort:'',company:''},firearm:{number:'',status:''},interfaceOrder:layout?.order||['room','firearm','assets','uniform','supplies'],interfaceCollapsed:layout?.collapsed||[],duty:{isDuty:layout?.duty??false,assignments:[]},room:null,assets:null,uniform:null,supplies:[],warnings:[],loading:true,updatedAt:new Date().toISOString()});for(const id of ['room','firearm','duty','assets','uniform','supplies'])personalLoadingCardV425(id,true);if(!last?.person)$('status').textContent='정보를 불러오고 있습니다…';}
function personalDetailsPriorityV525(corePending,expanded){if(expanded)return request('details');const generation=ticket;return new Promise((resolve,reject)=>{let started=false;const start=()=>{if(started)return;started=true;if(personalDeferredDetailsV525===start)personalDeferredDetailsV525=null;if(generation!==ticket){resolve(null);return;}request('details').then(resolve,reject);};personalDeferredDetailsV525=start;const afterCore=()=>{if(started)return;if(typeof requestIdleCallback==='function')requestIdleCallback(start,{timeout:500});else setTimeout(start,80);};corePending.then(afterCore,afterCore);});}
function personalDetailTasksV527(corePending){
 const ids=['uniform','supplies'],expanded=ids.filter(id=>$(id)?.closest('section.card')?.dataset.personalCollapsed!=='true'),generation=ticket;
 if(expanded.length===2)return [['details',request('details')]];
 if(expanded.length===0){let start;const pending=new Promise((resolve,reject)=>{let started=false;start=()=>{if(started)return;started=true;if(generation!==ticket){resolve(null);return;}request('details').then(resolve,reject);};corePending.then(()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(start,{timeout:500});else setTimeout(start,80);},()=>start());});personalDeferredDetailsV525=start;return [['details',pending]];}
 const early=expanded.map(id=>[id,request(id)]),earlyDone=Promise.allSettled(early.map(([,pending])=>pending));
 const starts=new Map(),late=ids.filter(id=>!expanded.includes(id)).map(id=>[id,new Promise((resolve,reject)=>{
  let started=false;const start=()=>{if(started)return;started=true;starts.delete(id);if(generation!==ticket){resolve(null);return;}request(id).then(resolve,reject);};starts.set(id,start);
  Promise.allSettled([corePending,earlyDone]).then(()=>{if(started)return;const schedule=()=>{if(!started)start();};if(typeof requestIdleCallback==='function')requestIdleCallback(schedule,{timeout:500});else setTimeout(schedule,80);});
 })]);
 personalDeferredDetailsV525=id=>{if(id)starts.get(id)?.();else for(const start of starts.values())start();};
 return [...early,...late];
}
function personalLoadPartV425(part){personalLoadPartsV425.add(part);for(const id of part==='core'?['room','firearm','assets']:[part])personalLoadingCardV425(id,false);$('status').textContent=personalLoadPartsV425.size===4?'조회 완료':'나머지 정보를 불러오고 있습니다…';}
function personalSaveOverlayV425(show){let overlay=$('personalSaveOverlayV425');if(!overlay){overlay=element('div','','personal-save-overlay-v425');overlay.id='personalSaveOverlayV425';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.setAttribute('aria-atomic','true');overlay.innerHTML='<div class="personal-save-dialog-v425"><span class="personal-save-spinner-v425" aria-hidden="true"></span><strong>저장·요청 처리 중</strong><p data-save-progress>입력 내용을 처리하고 있습니다.<br>완료될 때까지 잠시 기다려 주세요.</p></div>';document.body.append(overlay);}overlay.hidden=!show;$('dashboard').inert=show;clearTimeout(personalOverlayTimerV425);if(show){overlay.querySelector('[data-save-progress]').textContent='입력 내용을 처리하고 있습니다. 완료될 때까지 잠시 기다려 주세요.';personalOverlayTimerV425=setTimeout(()=>{overlay.querySelector('[data-save-progress]').textContent='처리가 이어지고 있습니다. 창을 닫거나 다시 누르지 말고 기다려 주세요.';},8000);}}
function personalSaveCardV425(path){return (path==='duty-request'?$('personalDutyV400'):$(path==='supply-request'?'supplies':path==='uniform-request'?'uniform':path==='assets'?'assets':'firearm')?.closest('section.card'));}
function personalSaveDoneV425(path){if(path==='supply-request')return;personalCompletedPathsV425.add(path);const card=personalSaveCardV425(path);if(!card)return;card.dataset.personalSaved='true';setTimeout(()=>{if(!personalCompletedPathsV425.has(path))return;for(const button of card.querySelectorAll('button[type=submit]')){button.dataset.savedLabel=button.textContent;button.textContent='저장 완료';button.disabled=true;}let notice=card.querySelector('[data-save-complete]');if(!notice){notice=element('p','저장 완료 · 내용을 변경하면 다시 저장할 수 있습니다.','personal-save-complete-v425');notice.dataset.saveComplete='';notice.setAttribute('role','status');card.append(notice);}},0);}
document.addEventListener('input',event=>{const card=event.target.closest?.('[data-personal-saved]');if(!card)return;delete card.dataset.personalSaved;for(const path of ['assets','uniform-request','duty-request','firearm-request','supply-request'])if(personalSaveCardV425(path)===card)personalCompletedPathsV425.delete(path);card.querySelector('[data-save-complete]')?.remove();for(const button of card.querySelectorAll('button[data-saved-label]')){button.textContent=button.dataset.savedLabel;delete button.dataset.savedLabel;}});

const restored=sessionStore.read();if(restored){keepSessionV338(restored);$('login').hidden=true;$('dashboard').hidden=false;$('status').textContent='정보 불러오는 중…';queueMicrotask(()=>load().catch(e=>{if(token)$('status').textContent=e.message;}));}
document.documentElement.removeAttribute('data-personal-restoring');
window.addEventListener('pageshow',e=>{if(!token)return;if(Date.now()>=expiresAt){clear('인증 시간이 만료되었습니다.');return;}if(e.persisted&&!sessionStore.read()){clear('조회가 종료되었습니다.');return;}});
let uniformEditV350=null,uniformDirtyV350=false;
function fields(id,values){
 if(id!=='uniform'||!uniformEditV350)return plainFields(id,values);
 if(uniformDirtyV350)return;
 const root=$('uniform');root.replaceChildren();
 const form=document.createElement('form'),table=document.createElement('table');table.className='personal-uniform-table';
 const head=document.createElement('thead');head.innerHTML='<tr><th>품목</th><th>사이즈</th></tr>';table.append(head);
 const body=document.createElement('tbody');for(const item of uniformEditV350.items){const tr=document.createElement('tr'),th=element('th',item),td=document.createElement('td'),input=document.createElement('input');input.value=values?.[item]||'';input.maxLength=32;input.dataset.uniformItem=item;input.setAttribute('aria-label',item+' 사이즈');td.append(input);tr.append(th,td);body.append(tr);}table.append(body);
 const direct=uniformEditV350.policy?.mode==='direct',message=element('p',direct?'전수조사 기간 · 저장 즉시 반영하고 조사 기록으로 보관합니다.':'변경은 관리자 확인 후 반영','hint'),button=element('button',direct?'전수조사 저장':'수정 요청');button.type='submit';button.disabled=!direct;form.append(table,message,button);root.append(form);
 if(uniformEditV350.requests?.length){const history=document.createElement('details');history.append(element('summary','수정 요청 '+uniformEditV350.requests.length+'건'));uniformEditV350.requests.forEach(r=>history.append(element('p',r.createdAt.slice(0,10)+' · '+r.status+(r.note?' · '+r.note:''),'hint')));root.append(history);}
 const original={...values},meta=uniformEditV350;
 const changes=()=>[...form.querySelectorAll('[data-uniform-item]')].filter(input=>input.value.trim()!==(original[input.dataset.uniformItem]||'')).map(input=>({item:input.dataset.uniformItem,size:input.value.trim()}));
 form.oninput=()=>{uniformDirtyV350=changes().length>0;button.disabled=!direct&&!uniformDirtyV350;};
 form.onsubmit=async e=>{e.preventDefault();if(busy||!token||!direct&&!uniformDirtyV350)return;busy=true;form.inert=true;$('refresh').disabled=true;const current=ticket;message.textContent=direct?'저장 중…':'요청 중…';try{const result=await request('uniform-request',{changes:changes(),expectedUpdatedAt:meta.updatedAt,campaignId:direct?meta.policy.id:''});if(current!==ticket||!token)return;uniformDirtyV350=false;uniformEditV350=result.uniformEdit;fields('uniform',result.uniform);$('uniform').prepend(element('p',result.direct?'전수조사 저장 완료 · 즉시 반영 및 기록 보관':'수정 요청 접수 · 관리자 확인 대기','hint'));}catch(error){if(current===ticket)message.textContent=error.message;}finally{busy=false;form.inert=false;if(current===ticket)$('refresh').disabled=false;}};
}
window.addEventListener('beforeunload',e=>{if(uniformDirtyV350){e.preventDefault();e.returnValue='';}});

function personalDutyLayoutV404(order){
 const defaults=['room','firearm','duty','assets','uniform','supplies'],known=new Set(defaults);
 return [...new Set([...(Array.isArray(order)?order:[]),...defaults])].filter(id=>known.has(id));
}
const personalCollapsedOverridesV525=new Map();
function personalDetailsExpandedV525(){return ['uniform','supplies'].some(id=>$(id)?.closest('section.card')?.dataset.personalCollapsed!=='true');}
function personalInterfaceOrderV359(order,collapsed){
 const defaults=['room','firearm','assets','uniform','supplies'],duty=$('personalDutyV400'),eligible=!!duty&&!duty.hidden,known=new Set([...defaults,...(eligible?['duty']:[])]),seen=new Set(),grid=document.querySelector('#dashboard>.grid');if(!grid)return;
 const values=eligible?personalDutyLayoutV404(order):[...(Array.isArray(order)?order:defaults),...defaults];
 const defaultCollapsed=new Set(Array.isArray(collapsed)?collapsed:[]);
 for(const id of values){
  if(!known.has(id)||seen.has(id))continue;
  seen.add(id);
  const card=id==='duty'?duty:$(id)?.closest('section.card');if(!card)continue;
  grid.appendChild(card);
  let heading=card.querySelector(':scope > .personal-card-header-v525');
  if(!heading){
   heading=document.createElement('h2');heading.className='personal-card-header-v525';
   heading.textContent=card.querySelector('h2')?.textContent||id;
   heading.tabIndex=0;heading.setAttribute('role','button');heading.setAttribute('aria-label',heading.textContent+' 접기 또는 펼치기');
   heading.onclick=()=>{const next=card.dataset.personalCollapsed!=='true';personalCollapsedOverridesV525.set(id,next);card.dataset.personalCollapsed=String(next);heading.setAttribute('aria-expanded',String(!next));if(!next&&['uniform','supplies'].includes(id))personalDeferredDetailsV525?.(id);};
   heading.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();heading.click();}};
   card.prepend(heading);
  }
  const isCollapsed=personalCollapsedOverridesV525.has(id)?personalCollapsedOverridesV525.get(id):defaultCollapsed.has(id);
  card.dataset.personalCollapsed=String(isCollapsed);heading.setAttribute('aria-expanded',String(!isCollapsed));
 }
}

﻿let personalDutyDirtyV400=false;
function personalDutyColumnsV420(table){const columns=element('colgroup');for(const width of ['26%','37%','37%']){const col=element('col');col.style.width=width;columns.append(col);}table.prepend(columns);}
const personalDutyDraftsV400=new Map();
function personalDutyResetV400(){personalDutyDirtyV400=false;personalDutyDraftsV400.clear();$('personalDutyCardsV400').replaceChildren();$('personalDutyV400').hidden=true;}
function personalDutyRenderV400(data){
 if(data.loading){personalDutyResetV400();if(data.duty?.isDuty){$('personalDutyV400').hidden=false;$('personalDutyCardsV400').append(element('p','불러오는 중…','hint'));}return;}
 const duty=data.duty;if(!duty?.isDuty||!duty.assignments?.length){personalDutyResetV400();return;}
 const root=$('personalDutyCardsV400');root.replaceChildren();$('personalDutyV400').hidden=false;personalDutyDirtyV400=false;personalDutyDraftsV400.clear();
 const form=element('form'),editors=[];
 for(const assignment of duty.assignments){
  if(assignment.saber){
   const saber=assignment.saber,table=element('table','','personal-duty-table'),head=element('thead'),roleRow=element('tr'),role=element('th',assignment.duty+' · 예도');role.colSpan=3;roleRow.append(role);head.append(roleRow);const headings=element('tr');for(const label of ['품목','상태','세부사항'])headings.append(element('th',label));head.append(headings);table.append(head);personalDutyColumnsV420(table);const body=element('tbody'),row=element('tr'),state=element('td'),details=element('td'),select=element('select'),note=element('textarea');select.setAttribute('aria-label',assignment.duty+' 예도 상태');for(const status of ['','정상','수리 필요','사용 불가']){const option=element('option',status||'미등록');option.value=status;select.append(option);}select.value=saber.status||'';note.value=saber.detail||'';note.maxLength=1500;note.placeholder='세부사항';note.setAttribute('aria-label',assignment.duty+' 예도 세부사항');select.disabled=note.disabled=!!saber.conflict;select.onchange=()=>form.oninput?.();state.append(select);details.append(note);row.append(element('th','예도'),state,details);body.append(row);table.append(body);form.append(table);if(!saber.conflict)editors.push({key:'saber|'+saber.key,before:{status:saber.status||'',detail:saber.detail||''},read:()=>({status:select.value,detail:note.value.trim()})});else form.append(element('p','예도 배정이 중복되어 관리자 확인이 필요합니다.','hint'));
  }
  const table=element('table','','personal-duty-table'),head=element('thead'),roleRow=element('tr'),role=element('th',assignment.duty+' · 흉장·블럭·명패·아크릴판');role.colSpan=3;roleRow.append(role);head.append(roleRow);const headings=element('tr');for(const label of ['품목','수량','세부사항'])headings.append(element('th',label));head.append(headings);table.append(head);personalDutyColumnsV420(table);const body=element('tbody');
  for(const item of assignment.items||[]){if(item.item==='saber'||!(item.required>0))continue;
   const shortage=item.quantity===null?'미등록':item.shortage>0?item.shortage+'개 부족':'';const row=element('tr'),name=element('th',item.label+(shortage?'('+shortage+')':'')),quantity=element('td'),details=element('td'),select=element('select'),custom=element('input'),note=element('textarea');row.dataset.dutyItem=item.item;name.style.cssText=quantityColorV502(item.required,item.quantity);if(shortage){row.dataset.dutyShortage='true';name.title=shortage;}
   select.setAttribute('aria-label',assignment.duty+' '+item.label+' 수량');const blank=element('option','선택');blank.value='';select.append(blank);
   for(let count=0;count<=item.required;count++){const option=element('option',count+'개');option.value=String(count);select.append(option);}const direct=element('option','직접 입력');direct.value='direct';select.append(direct);
   select.value=item.quantity===null?'':item.quantity<=item.required?String(item.quantity):'direct';custom.type='number';custom.min='0';custom.max='1000';custom.step='1';custom.value=item.quantity??'';custom.hidden=select.value!=='direct';custom.setAttribute('aria-label',assignment.duty+' '+item.label+' 직접 입력');custom.placeholder='직접 입력 수량';
   note.value=item.detail||'';note.maxLength=1500;note.placeholder='세부사항';note.setAttribute('aria-label',assignment.duty+' '+item.label+' 세부사항');note.dataset.dutyDetail='true';
   select.onchange=()=>{custom.hidden=select.value!=='direct';if(!custom.hidden)custom.focus?.();form.oninput?.();};quantity.append(select,custom);details.append(note);row.append(name,quantity,details);body.append(row);
   editors.push({key:assignment.id+'|'+item.item,before:{quantity:item.quantity,detail:item.detail||''},read:()=>({quantity:select.value==='direct'?(custom.value===''?null:Number(custom.value)):select.value===''?null:Number(select.value),detail:note.value.trim()})});
  }
  table.append(body);form.append(table);
 }
 const direct=duty.policy?.mode==='direct',message=element('p',direct?'전수조사 기간 · 저장 즉시 반영하고 조사 기록으로 보관합니다.':'입력한 내용은 관리자 확인 후 반영됩니다.','hint'),button=element('button',direct?'전수조사 저장':'수정 요청');button.type='submit';button.disabled=!direct;form.append(message,button);root.append(form);
 const changes=()=>editors.map(editor=>({key:editor.key,value:editor.read(),before:editor.before})).filter(change=>JSON.stringify(change.value)!==JSON.stringify(change.before));
 form.oninput=()=>{personalDutyDirtyV400=changes().length>0;personalDutyDraftsV400.set(form,personalDutyDirtyV400);button.disabled=!direct&&!personalDutyDirtyV400;};
 form.onsubmit=async event=>{event.preventDefault();if(busy||!token||!direct&&!changes().length)return;if(changes().some(change=>'quantity' in change.value&&(!Number.isInteger(change.value.quantity)||change.value.quantity<0||change.value.quantity>1000))){message.textContent='수량을 선택하거나 0~1000 사이 정수로 직접 입력하세요.';return;}busy=true;form.inert=true;$('refresh').disabled=true;const current=ticket;message.textContent=direct?'저장 중…':'요청 중…';try{const result=await request('duty-request',{snapshot:duty.snapshot,campaignId:direct?duty.policy.id:'',changes:changes().map(({key,value})=>({key,value}))});if(current!==ticket||!token)return;personalDutyDirtyV400=false;personalDutyDraftsV400.clear();if(result.direct){personalDutyRenderV400({duty:result.duty});root.prepend(element('p','전수조사 저장 완료 · 즉시 반영 및 기록 보관','hint'));}else{for(const editor of editors)editor.before=editor.read();button.disabled=true;message.textContent='수정 요청 접수 · 관리자 확인 대기';}}catch(error){if(current===ticket)message.textContent=error.message;}finally{busy=false;form.inert=false;if(current===ticket)$('refresh').disabled=false;}};
 if(duty.requests?.length){const history=element('details');history.append(element('summary','수정 요청 내역'));for(const request of duty.requests)history.append(element('p',request.createdAt.slice(0,10)+' · '+request.status+(request.note?' · '+request.note:''),'hint'));root.append(history);}
}
window.addEventListener('beforeunload',event=>{if(personalDutyDirtyV400){event.preventDefault();event.returnValue='';}});

﻿let personalFirearmDirtyV413=false;
function personalFirearmResetV413(){personalFirearmDirtyV413=false;$('personalFirearmV413')?.remove();}
function personalFirearmRenderV413(data){personalFirearmResetV413();const info=data.firearm;if(data.loading||!info?.snapshot)return;const root=element('div');root.id='personalFirearmV413';const form=element('form'),label=element('label','총기 상태'),select=element('select'),detailLabel=element('label','세부사항'),note=element('textarea'),message=element('p','','hint'),button=element('button');for(const value of ['','정상','수리 필요','사용 불가']){const option=element('option',value||'상태 선택');option.value=value;select.append(option);}select.value=info.status||'';select.setAttribute('aria-label','본인 총기 상태');note.value=info.detail||'';note.maxLength=1500;note.rows=3;note.placeholder='총기 상태 세부사항';note.setAttribute('aria-label','본인 총기 세부사항');label.append(select);detailLabel.append(note);const direct=info.policy?.mode==='direct',editable=info.canEdit!==false;button.type='submit';button.textContent=direct?'전수조사 저장':'수정 요청';button.disabled=!editable;form.append(element('p',direct?'전수조사 기간에는 저장 즉시 반영됩니다.': '관리자 확인 후 총기 기록에 반영됩니다.','hint'),label,detailLabel,message,button);root.append(form);$('firearm').after(root);let baseline={status:info.status||'',detail:info.detail||''};const current=()=>({status:select.value,detail:note.value.trim()});form.oninput=()=>{personalFirearmDirtyV413=JSON.stringify(current())!==JSON.stringify(baseline);button.disabled=!editable;};select.onchange=form.oninput;
 form.onsubmit=async event=>{event.preventDefault();if(busy||!token)return;if(!select.value){message.textContent='총기 상태를 선택하세요.';return;}const value=current(),generation=ticket;busy=true;form.inert=true;$('refresh').disabled=true;message.textContent=direct?'저장 중…':'요청 중…';try{const result=await request('firearm-request',{snapshot:info.snapshot,...value,campaignId:direct?info.policy.id:''});if(generation!==ticket||!token)return;personalFirearmDirtyV413=false;baseline=value;button.disabled=!editable;message.textContent=result.direct?'전수조사 응답 저장 완료':result.cancelled?'기존 대기 요청을 취소했습니다.':result.unchanged?'변경한 항목이 없습니다.':'수정 요청 접수 · 관리자 확인 대기';if(result.firearm){fields('firearm',{'총기번호':result.firearm.number,'상태':result.firearm.status});personalFirearmRenderV413({firearm:result.firearm});const visible=$('personalFirearmV413');visible?.querySelector?.('[role=status]')?.replaceChildren(element('span','전수조사 응답 저장 완료'));} }catch(error){if(generation===ticket)message.textContent=error.message;}finally{busy=false;form.inert=false;if(generation===ticket)$('refresh').disabled=false;}};message.setAttribute('role','status');
 if(info.requests?.length){const history=element('details');history.append(element('summary','총기 수정 요청 내역'));for(const request of info.requests)history.append(element('p',new Date(request.createdAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+request.status,'hint'));root.append(history);}
}
window.addEventListener('beforeunload',event=>{if(personalFirearmDirtyV413){event.preventDefault();event.returnValue='';}});

function personalConditionV421(value){const text=String(value||'').replace(/\s/g,'');return (text.includes('교체')||text.includes('사용불가'))?'replacement':text.includes('수리')?'repair':'';}
function personalConditionMarkV421(node,value){const condition=personalConditionV421(value);if(condition)node.dataset.personalCondition=condition;else delete node.dataset.personalCondition;}
function personalConditionsRenderV421(){
 const root=$('dashboard');if(!root)return;
 for(const select of root.querySelectorAll('select')){
  if(![...select.options].some(option=>personalConditionV421(option.value)))continue;
  personalConditionMarkV421(select,select.value);
  const box=select.closest('.personal-state-select');if(box)personalConditionMarkV421(box,select.value);
  const row=select.closest('tr');if(row)personalConditionMarkV421(row,select.value);
 }
 for(const row of root.querySelectorAll('#supplies tbody tr')){const cell=row.querySelector('[data-supply-status]')||row.children[1];if(cell){const value=cell.querySelector('select')?.value??cell.textContent;personalConditionMarkV421(cell,value);personalConditionMarkV421(row,value);}}
 for(const row of root.querySelectorAll('#firearm>div')){if(row.querySelector('dt')?.textContent==='상태'){const cell=row.querySelector('dd');if(cell)personalConditionMarkV421(cell,cell.textContent);}}
}
let personalConditionFrameV421=0;
function personalConditionsScheduleV421(){if(personalConditionFrameV421)return;personalConditionFrameV421=requestAnimationFrame(()=>{personalConditionFrameV421=0;personalConditionsRenderV421();});}
document.addEventListener('change',event=>{if(event.target.closest?.('#dashboard'))personalConditionsRenderV421();});
new MutationObserver(personalConditionsScheduleV421).observe($('dashboard'),{childList:true,subtree:true,characterData:true});
personalConditionsScheduleV421();

})();