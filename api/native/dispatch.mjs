const personalActions={pagesPersonalGet:'get',pagesPersonalDuty:'duty',pagesPersonalLogout:'logout',pagesPersonalAssets:'assets',pagesPersonalDetails:'details',pagesPersonalSupplies:'supplies',pagesPersonalUniform:'uniform',pagesPersonalUniformRequest:'uniform-request',pagesPersonalDutyRequest:'duty-request',pagesPersonalFirearmRequest:'firearm-request',pagesPersonalSupplyRequest:'supply-request'};
function deny(code='FORBIDDEN',message='접근 권한이 없습니다.'){const e=Error(message);e.pagesCode=code;throw e;}
export function dispatch(actor,api,props,uuid,now=Date.now()){
 if(actor.method==='pagesInstructorTemporary'){
  if(actor.email!=='temporary@instructor.invalid'||actor.sub!=='instructor-temporary'||actor.sessionId)deny();
  return api.instructorTemporary(...actor.args);
 }
 if(actor.sub==='instructor-temporary')deny();
 if(actor.method==='pagesPersonalLogin'){
  if(actor.email!=='personal@portal.invalid'||actor.sub!=='personal-login'||actor.sessionId)deny();
  return api.personal('login',actor.args[0]);
 }
 if(personalActions[actor.method]){
  if(actor.email!=='personal@portal.invalid'||!actor.sub.startsWith('personal:'))deny();
  return api.personal(personalActions[actor.method],actor.args[0]);
 }
 if(actor.sub.startsWith('personal:')||actor.sub==='personal-login')deny();
 if(actor.sessionId){
  let session;try{session=JSON.parse(props.getProperty('PAGES_SESSION_'+actor.sessionId)||'null');}catch{}
  if(!session||session.email!==actor.email||session.sub!==actor.sub||session.expiresAt<=now)deny('SESSION_EXPIRED','로그인 유지 기간이 만료되었습니다. 다시 로그인하세요.');
 }
 if(actor.method==='pagesSessionLogout'){if(actor.sessionId)props.deleteProperty('PAGES_SESSION_'+actor.sessionId);return true;}
 if(actor.method==='pagesSessionCreate'){
  const bootstrap=api.call('getBootstrap',[]);let count=0;
  for(const[key,value]of Object.entries(props.getProperties()))if(key.startsWith('PAGES_SESSION_')){
   let s;try{s=JSON.parse(value);}catch{}
   if(!s||s.expiresAt<=now)props.deleteProperty(key);else if(s.email===actor.email)count++;
  }
  if(count>=30)throw Error('로그인한 기기가 너무 많습니다. 기존 기기에서 로그아웃하세요.');
  const sessionId=uuid(),expiresAt=now+30*86400000;
  props.setProperty('PAGES_SESSION_'+sessionId,JSON.stringify({email:actor.email,sub:actor.sub,expiresAt}));
  return {bootstrap,sessionId,expiresAt};
 }
 // A Google JWT may call RPC before a persistent session exists, matching the existing gateway.
 return api.call(actor.method,actor.args);
}

export function normalizeResponse(value){return JSON.parse(JSON.stringify(value??null,function(key,item){
 if(['status','firearmStatus'].includes(key)&&typeof item==='string'){
  if(key==='status'&&this.unavailable===true)return '사용 불가';
  const compact=item.replace(/\s/g,'');if(['교체필요','사용불가'].includes(compact))return '사용 불가';if(compact.includes('수리필요'))return '수리 필요';
 }return item;
}));}
