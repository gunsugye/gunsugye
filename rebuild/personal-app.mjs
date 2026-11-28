import {googleLogin} from './google-login.mjs';
import {client,currentMember} from './client.mjs';
import {el,button,select,table,formDialog,dialog,notify} from './ui.mjs';
import {catalog,allRows,rows,rpc,setting,personLabel} from './data.mjs';
import {completeness,itemLabel} from './catalog.mjs';
import {valueCell} from './inventory.mjs';
import {sections} from './reviews.mjs';
const root=document.querySelector('#cards'),header=document.querySelector('header');let member,person,cats,config,selectedPerson;const drafts=new Map(),records=new Map(),loaded=new Set();let batch=null;
async function boot(){root.replaceChildren();try{member=await currentMember();if(!member){notify('Google 계정으로 로그인하세요.');header.append(button('Google 로그인',googleLogin));return;}
 header.append(button('로그아웃',async()=>{const {error}=await client.auth.signOut();if(error)throw error;location.reload();}));
 if(!member.person_id)throw Error('이 계정에 연결된 인원이 없습니다. 관리자가 권한 관리에서 인원을 연결해야 합니다.');
 [person]=await rows('app2_people',{filters:{id:selectedPerson||member.person_id}});if(!person)throw Error('연결된 인원을 조회할 수 없습니다.');
 if(member.role==='mentor'){const trainees=await allRows('app2_people',{filters:{mentor_id:member.person_id},order:'name'}),picker=select([[member.person_id,'본인 기록'],...trainees.map(p=>[p.id,personLabel(p)])],'담당 예비생도',selectedPerson||member.person_id);header.querySelectorAll('select').forEach(n=>n.remove());header.append(picker);picker.onchange=()=>{if(drafts.size&&!confirm('미제출 입력을 버리고 다른 인원을 조회할까요?')){picker.value=person.id;return;}selectedPerson=picker.value;drafts.clear();records.clear();loaded.clear();batch=null;header.querySelectorAll('button').forEach(n=>n.remove());boot();};}
 [cats,config]=await Promise.all([catalog(),setting('personal-interface',{sections:['firearm','supplies','duty','saber','assets','uniform'].map((id,i)=>({id,open:i===0,visible:true}))})]);notify(personLabel(person));
 root.append(button('일괄 전수조사 기록/수정 요청',review,'action primary bulk-save'));
 const priority=[];for(const item of config.value.sections){if(!item.visible||!sections[item.id])continue;const card=el('details',null,'panel personal-card');card.open=Boolean(item.open);card.append(el('summary',sections[item.id]));const body=el('div',null,'body');card.append(body);root.append(card);card.addEventListener('toggle',()=>{if(card.open)load(item.id,body).catch(e=>{body.replaceChildren(el('p',e.message,'error'));});});if(item.open)priority.push(()=>load(item.id,body));}
 root.append(button('일괄 전수조사 기록/수정 요청',review,'action primary bulk-save'));await Promise.all(priority.map(fn=>fn()));
 }catch(e){notify(e.message,true);}}
const pending=new Map();
async function load(section,body){if(loaded.has(section))return;if(pending.has(section))return pending.get(section);const task=(async()=>{body.replaceChildren(el('p','불러오는 중입니다.'));let items=cats.filter(c=>c.enabled&&c.section===section);if(['duty','saber'].includes(section)){const duties=await rows('app2_duties',{filters:{person_id:person.id}});if(!duties.length){body.replaceChildren(el('p','배정된 근무가 없습니다.'));loaded.add(section);return;}}
 let filter={person_id:person.id};if(section==='assets'){const occupancy=await rows('app2_occupancy',{filters:{person_id:person.id}});if(!occupancy.length){body.replaceChildren(el('p','배정된 생활실이 없습니다.'));loaded.add(section);return;}filter={room_id:occupancy[0].room_id};}
 if(items.length){const found=await allRows('app2_inventory',{filters:{...filter,catalog_id:items.map(c=>c.id)}});for(const r of found)records.set(r.catalog_id,r);}
 loaded.add(section);draw();function draw(){body.replaceChildren(el('p','품목을 눌러 작성한 뒤 한 번에 제출하세요.'),el('p','미작성 · 부분작성 · 작성 완료','completion-key'));for(const c of items){const r=records.get(c.id),v=drafts.get(c.id)?.values||r?.values||{},done=completeness(c,v);const title=itemLabel(c,r?.values)+(done.status==='partial'?` (${done.missing.join(', ')} 미작성)`:'');const label=button(title,()=>formDialog(c.name,c.fields,v,{onSave:async values=>{drafts.set(c.id,{person_id:person.id,catalog_id:c.id,version:r?.version||0,values});batch=null;draw();}}),'item-link '+done.status);body.append(table(['품목',...c.fields.map(f=>f.label)],[[label,...c.fields.map(f=>valueCell(c,f,v[f.key]))]]));}}
 })().finally(()=>pending.delete(section));pending.set(section,task);return task;}
async function review(){
 if(!person)throw Error('로그인 정보를 확인하세요.');const surveys=await allRows('app2_surveys',{filters:{mode:person.mode,enabled:true}}),now=Date.now();const active=section=>surveys.some(s=>s.section===section&&(!s.company||s.company===person.company)&&(!s.cohort||s.cohort===person.cohort)&&new Date(s.starts_at)<=now&&new Date(s.ends_at)>now);
 const payload=[];for(const c of cats.filter(c=>c.enabled&&loaded.has(c.section))){const r=records.get(c.id),draft=drafts.get(c.id),v=draft?.values||r?.values;if(!v)continue;const changed=JSON.stringify(v)!==JSON.stringify(r?.values||{});if(changed||active(c.section))payload.push({person_id:person.id,catalog_id:c.id,version:r?.version||0,values:v});}
 if(!payload.length){notify('제출할 변경사항이 없습니다. 전수조사 항목은 펼쳐서 내용을 확인하세요.');return;}
 const box=dialog('일괄 전수조사 기록/수정 요청 확인'),diff=[];for(const item of payload){const c=cats.find(c=>c.id===item.catalog_id),before=records.get(c.id)?.values||{};for(const f of c.fields)if(JSON.stringify(before[f.key]??null)!==JSON.stringify(item.values[f.key]??null))diff.push([c.name,f.label,before[f.key]??'미작성',item.values[f.key]??'미작성']);}
 box.body.append(el('p',`전수조사 ${payload.filter(i=>active(cats.find(c=>c.id===i.catalog_id).section)).length}품목 · 수정요청 ${payload.filter(i=>!active(cats.find(c=>c.id===i.catalog_id).section)).length}품목`));box.body.append(diff.length?table(['품목','항목','이전','입력값'],diff):el('p','변경사항 없이 현재 값을 전수조사 기록으로 제출합니다.'));
 box.actions.append(button('취소',box.close),button('확인 후 제출',()=>box.run(async()=>{batch??=crypto.randomUUID();const result=await rpc('app2_submit',{p_batch:batch,p_items:payload});drafts.clear();records.clear();loaded.clear();batch=null;root.replaceChildren();header.querySelectorAll('button').forEach(b=>b.remove());await boot();notify(`${result.length}품목 제출했습니다. 수정요청은 검토 후 반영됩니다.`);}), 'action primary'));
}
window.addEventListener('beforeunload',e=>{if(drafts.size){e.preventDefault();e.returnValue='';}});boot();
