// Pure planning only. The caller must persist receipts atomically before applying them.
const clean=value=>String(value??'').normalize('NFKC').replace(/\s+/g,'');
const cohort=value=>clean(value).replace(/기+$/,'');
const company=value=>clean(value).replace(/중대+$/,'');
const identityKey=(a,b,c)=>[cohort(a),company(b),clean(c)].join('\u0000');

export function buildFormRosterIndex(people){
 const identities=new Map();
 for(const person of people){const key=identityKey(person.cohort,person.company,person.name);if(!identities.has(key))identities.set(key,[]);identities.get(key).push(person);}
 return identities;
}

// Three matching fields can identify a unique person even if their number was
// entered incorrectly. A different company or an ambiguous name needs review.
export function matchFormPerson(index,identity){
 const candidates=index.get(identityKey(identity.cohort,identity.company,identity.name))||[];
 if(candidates.length===1)return {person:candidates[0],reason:null};
 const number=clean(identity.cadetNumber);
 const exact=number?candidates.filter(p=>clean(p.cadetNumber)===number):[];
 return exact.length===1?{person:exact[0],reason:null}:{person:null,reason:candidates.length?'ambiguous_identity':'identity_not_found'};
}

function normalizeStatus(value){
 const compact=clean(value);
 if(['교체필요','사용불가'].includes(compact))return '사용 불가';
 if(/^수리필요(?:\((?:미보고|보고|보고완료)\))?$/.test(compact))return '수리 필요';
 return String(value??'').trim();
}

// Keep a separate identity for each edited response; never use a timestamp alone
// as a deduplication key. No empty answer clears a previously stored value.
export function planFormResponses({formId,responses,questions,people,items,existingReceipts=[]}){
 if(!formId||!Array.isArray(responses)||!Array.isArray(people)||!Array.isArray(items))throw Error('폼 수집 자료를 확인하세요.');
 const roster=buildFormRosterIndex(people),seen=new Set(existingReceipts.map(r=>[r.formId,r.responseId,r.submittedAt].join('\u0000'))),planned=new Set();
 const itemMap=new Map(items.map(i=>[clean(i.name),i])),out=[],review=[];
 for(const response of responses){
  const responseId=String(response.responseId||''),submittedAt=String(response.lastSubmittedTime||response.createTime||''),time=Date.parse(submittedAt);
  if(!responseId||!Number.isFinite(time)){review.push({responseId,reason:'invalid_response'});continue;}
  const receiptKey=[formId,responseId,submittedAt].join('\u0000');if(seen.has(receiptKey)||planned.has(receiptKey))continue;
  const answers={};for(const [questionId,value] of Object.entries(response.answers||{})){const title=questions[questionId];if(!title)continue;const values=(value.textAnswers?.answers||[]).map(x=>String(x.value??''));if(values.length)answers[title]=values.join(',');}
  const identity={cohort:answers['기수']||answers['기수 (이전 응답)'],company:answers['중대']||answers['중대 (이전 응답)'],name:answers['이름'],cadetNumber:answers['교번']};
  const match=matchFormPerson(roster,identity);if(!match.person){review.push({responseId,submittedAt,identity,reason:match.reason});continue;}
  const changes=new Map(),unknown=[];
  for(const [title,value] of Object.entries(answers)){
   const parts=title.match(/^(.+?)\s*·\s*(.+)$/);if(!parts||!String(value).trim())continue;
   const item=itemMap.get(clean(parts[1]));if(!item){unknown.push(title);continue;}
   const rawField=clean(parts[2])==='세부사항'?'세부내용':parts[2],field=item.fields.find(x=>clean(x)===clean(rawField));
   if(!field){unknown.push(title);continue;}
   if(!changes.has(item.id))changes.set(item.id,{});changes.get(item.id)[field]=clean(field).includes('상태')?normalizeStatus(value):String(value).trim();
  }
  if(unknown.length){review.push({responseId,submittedAt,personId:match.person.id,reason:'unknown_fields',fields:unknown});continue;}
  if(!changes.size){review.push({responseId,submittedAt,personId:match.person.id,reason:'no_answers'});continue;}
  planned.add(receiptKey);out.push({formId,responseId,submittedAt,personId:match.person.id,changes:[...changes].map(([itemId,fields])=>({itemId,fields}))});
 }
 return {receipts:out,review};
}

// Conflict checks are field-level: a newer value on another field must not hide
// a valid answer. Missing or unparseable times require review, never overwrite.
export function compareFormFields(receipt,current){
 const submitted=Date.parse(receipt.submittedAt),writes=[],review=[];
 for(const change of receipt.changes)for(const [field,value] of Object.entries(change.fields)){
  const prior=current?.[change.itemId]?.[field];
  if(!prior){writes.push({itemId:change.itemId,field,value});continue;}
  if(clean(prior.value)===clean(value))continue;
  const at=Date.parse(prior.updatedAt||'');
  if((prior.value===undefined||prior.value===null||String(prior.value).trim()==='')&&!prior.updatedAt){writes.push({itemId:change.itemId,field,value});continue;}
  if(!Number.isFinite(at)||at===submitted)review.push({itemId:change.itemId,field,reason:'time_conflict'});
  else if(at<submitted)writes.push({itemId:change.itemId,field,value});
 }
 return {writes,review};
}
