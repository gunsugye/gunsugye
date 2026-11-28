import {client} from './client.mjs';
import {config} from './config.mjs';
let scriptReady;
function loadGoogle(){
 if(window.google?.accounts?.id)return Promise.resolve();
 return scriptReady??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;const timer=setTimeout(()=>{script.remove();scriptReady=null;reject(Error('Google 로그인 화면 연결 시간이 초과됐습니다. 다시 시도하세요.'));},15000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();scriptReady=null;reject(Error('Google 로그인 화면을 불러오지 못했습니다.'));};document.head.append(script);});
}
export async function googleLogin(){
 const box=document.createElement('dialog'),title=document.createElement('h2'),message=document.createElement('p'),target=document.createElement('div'),close=document.createElement('button');
 title.textContent='Google 로그인';message.textContent='로그인 화면을 준비하고 있습니다.';close.textContent='취소';close.className='action';close.onclick=()=>box.close();box.append(title,message,target,close);document.body.append(box);box.addEventListener('close',()=>box.remove());box.showModal();
 try{
  const [response]=await Promise.all([fetch(config.relay+'/login-config',{signal:AbortSignal.timeout(15000)}),loadGoogle()]);const data=await response.json();if(!response.ok)throw Error(data.message||'로그인 설정을 확인하지 못했습니다.');if(!box.isConnected)return;
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce))),x=>x.toString(16).padStart(2,'0')).join('');
  let busy=false;google.accounts.id.initialize({client_id:data.clientId,nonce:hash,auto_select:false,ux_mode:'popup',callback:async result=>{
   if(busy||!box.isConnected)return;busy=true;close.disabled=true;message.textContent='로그인을 확인하고 있습니다.';
   try{const {error}=await client.auth.signInWithIdToken({provider:'google',token:result.credential,nonce});if(error)throw error;location.reload();}catch(e){message.textContent=e.message;busy=false;close.disabled=false;}
  }});
  box.addEventListener('cancel',e=>{if(busy)e.preventDefault();});google.accounts.id.renderButton(target,{theme:'outline',size:'large',text:'signin_with',width:280});message.textContent='아래 Google 버튼에서 계정을 선택하세요.';
 }catch(e){message.textContent=e.message;}
}
