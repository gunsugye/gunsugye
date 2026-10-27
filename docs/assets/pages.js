/* Google 토큰은 메모리에서만 사용하며 서버 발급 세션을 30일 보관합니다. */
(() => {
'use strict';
const config=window.LOGBOOK_CONFIG||{}, key='logbook.session.v1', $=id=>document.getElementById(id);
let token='',expiresAt=0,appLoaded=false,authenticating=false,firstBootstrap=null,firstWorkspace=null;
const activeReads=new Map(),readMethods=new Set(['getBootstrap','getRosterData','getEquipmentData','getSupplyCatalog','getSupplyItemData','getUniformV278','getRepairDashboardV219','getSmartDutyExceptionV253','getDepartureDashboardV305']);
const status=message=>{$('pagesLoginStatus').textContent=message;};
function forget(){window.LOGBOOK_NAVIGATION?.clear();token='';expiresAt=0;activeReads.clear();document.documentElement?.removeAttribute?.('data-session-restoring');try{localStorage.removeItem(key);}catch(_){}}
function showLogin(message){forget();$('pagesLogin').hidden=false;$('pagesSession').hidden=true;if(appLoaded){$('pagesGoogleButton').hidden=true;$('pagesRetry').hidden=false;}status(message);}
async function request(path,method,args=[]){
 const loginEmail=path==='/session'?String($('pagesEmail').value||'').trim().toLowerCase():undefined;
 let response;try{response=await fetch(config.apiUrl.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({method,args,...(loginEmail?{loginEmail}:{})}),cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(90000)});}
 catch{throw Error('서버 응답을 확인할 수 없습니다. 자동 재시도하지 않습니다. 새로고침 후 저장 결과를 확인하세요.');}
 let body;try{body=await response.json();}catch{throw Error('API 서버 응답 형식을 확인하세요.');}
 if(response.status===401||response.status===403)showLogin(body.error||'다시 로그인하세요.');
 if(!response.ok||!body.ok)throw Error(body.error||'요청 처리에 실패했습니다.');return body.result;
}
async function call(method,args=[]){
 if(!token||Date.now()>=expiresAt){showLogin('로그인 유지 기간이 만료되었습니다. 다시 로그인하세요.');throw Error('Google 로그인이 필요합니다.');}
 if(firstBootstrap&&(method==='getBootstrap'||(method==='readCompressedV282'&&args[0]==='getBootstrap'))){const result=firstBootstrap;firstBootstrap=null;return result;}
 if(firstWorkspace&&method==='getWorkspaceExtraV221'){const result=firstWorkspace;firstWorkspace=null;return result;}
 const read=readMethods.has(method)||(method==='readCompressedV282'&&readMethods.has(args[0]));
 if(!read){activeReads.clear();try{return await request('/rpc',method,args);}finally{activeReads.clear();}}
 const readKey=JSON.stringify([method,args]);
 if(activeReads.has(readKey))return activeReads.get(readKey);
 const pending=request('/rpc',method,args);activeReads.set(readKey,pending);
 try{return await pending;}finally{if(activeReads.get(readKey)===pending)activeReads.delete(readKey);}
}
function runner(success,failure,userObject){return new Proxy({},{get(_target,name){
 if(name==='withSuccessHandler')return fn=>runner(fn,failure,userObject);
 if(name==='withFailureHandler')return fn=>runner(success,fn,userObject);
 if(name==='withUserObject')return object=>runner(success,failure,object);
 if(name==='then'||typeof name!=='string')return undefined;
 return(...args)=>{call(name,args).then(result=>success?.(result,userObject),error=>failure?failure(error,userObject):console.error(error.message));};
}});}
window.google=window.google||{};window.google.script={run:runner()};
function loadApp(bootstrap){
 window.LOGBOOK_NAVIGATION?.preview();
 firstWorkspace=request('/rpc','getWorkspaceExtraV221',[]);firstWorkspace.catch(()=>{});
 firstBootstrap=bootstrap;
 const account=value=>{$('pagesAccount').textContent=value.userEmail||'로그인됨';$('pagesSession').hidden=false;document.documentElement?.removeAttribute?.('data-session-restoring');};
 if(bootstrap&&typeof bootstrap.then==='function')bootstrap.then(account,error=>{if(!token){showLogin(error.message||'로그인을 다시 확인하세요.');return;}document.documentElement?.removeAttribute?.('data-session-restoring');$('pagesLogin').hidden=false;$('pagesGoogleButton').hidden=true;$('pagesRetry').hidden=false;status(error.message||'연결을 다시 확인하세요.');});else account(bootstrap);
 if(appLoaded){location.reload();return;}
 const version=document.documentElement?.dataset?.appVersion||'';
 const script=document.createElement('script');script.src='./assets/app.js'+(version?'?v='+encodeURIComponent(version):'');
 script.onerror=()=>{showLogin('화면 파일을 불러오지 못했습니다. 다시 시도하세요.');$('pagesRetry').hidden=false;};
 script.onload=()=>{if(token){$('pagesLogin').hidden=true;window.LOGBOOK_UPDATES?.start();}};appLoaded=true;document.body.appendChild(script);
}
$('pagesLogout').addEventListener('click',async()=>{
 if(!confirm('저장 중인 작업이 있다면 먼저 완료하세요. 로그아웃하시겠습니까?'))return;
 try{await request('/logout','logout');}catch(error){if(token){alert('로그아웃을 완료하지 못했습니다. 연결을 확인하고 다시 시도하세요.');return;}}
 forget();window.google.accounts?.id.disableAutoSelect();location.reload();
});
$('pagesRetry').addEventListener('click',()=>location.reload());
$('pagesEmailForm').addEventListener('submit',event=>{
 event.preventDefault();if(authenticating)return;
 if(!$('pagesEmail').reportValidity())return;
 initGoogle();status($('pagesEmail').value.trim()?'이메일을 적용했습니다. 아래 Google 버튼을 눌러 계속하세요.':'아래 Google 버튼에서 계정을 선택하세요.');
});
async function onCredential(response){
 if(authenticating)return;authenticating=true;status('로그인과 업무일지 접근 권한을 확인하고 있습니다.');
 try{if(!$('pagesEmail').reportValidity())throw Error('이메일 형식을 확인하세요.');token=response.credential;const session=await request('/session','login');token=session.token;expiresAt=session.expiresAt;
 if(!token?.startsWith('session.')||!Number.isFinite(expiresAt))throw Error('API 서버를 새 버전으로 배포하세요.');
 try{localStorage.setItem(key,JSON.stringify({token,expiresAt}));}catch(_){status('이 브라우저에서는 로그인 유지가 지원되지 않습니다.');}
 loadApp(session.bootstrap);
 }catch(error){showLogin(error.message||'로그인에 실패했습니다.');}finally{authenticating=false;}
}
function initGoogle(attempt=0){
 if(!window.google.accounts?.id){if(attempt>=150){status('Google 로그인 화면을 불러오지 못했습니다.');$('pagesRetry').hidden=false;return;}setTimeout(()=>initGoogle(attempt+1),100);return;}
 window.google.accounts.id.initialize({client_id:config.googleClientId,callback:onCredential,auto_select:false,login_hint:String($('pagesEmail').value||'').trim()||undefined});
 $('pagesGoogleButton').textContent='';
 window.google.accounts.id.renderButton($('pagesGoogleButton'),{type:'standard',theme:'filled_blue',size:'large',text:'continue_with',width:Math.min(400,$('pagesGoogleButton').clientWidth||320),locale:'ko'});
}
async function init(){
 if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.googleClientId||'')||!/^https:\/\//.test(config.apiUrl||'')){status('관리자 설정이 필요합니다. docs/config.js에 Google 클라이언트 ID와 API 주소를 입력하세요.');return;}
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.token?.startsWith('session.')&&saved.expiresAt>Date.now()){token=saved.token;expiresAt=saved.expiresAt;$('pagesLogin').hidden=true;status('저장된 로그인으로 업무일지를 불러옵니다.');loadApp(call('getBootstrap'));return;}}
 catch(error){if(token){status(error.message);$('pagesRetry').hidden=false;return;}}
 forget();status('등록된 Google 계정으로 로그인하세요. 같은 브라우저에서 30일간 유지됩니다.');initGoogle();
}
init();
})();
