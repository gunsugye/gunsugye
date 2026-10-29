export function personalSessionStore(getStorage,now=()=>Date.now()){
 const key='logbook.personal.session.v338';
 const valid=s=>s&&typeof s.token==='string'&&/^session\.[\w-]+\.[\w-]+$/.test(s.token)&&s.token.length<16000&&Number.isFinite(s.expiresAt)&&s.expiresAt>now()&&s.expiresAt<=now()+16*60000;
 const clear=()=>{try{getStorage().removeItem(key);}catch(_){}};
 return {clear,read(){try{const s=JSON.parse(getStorage().getItem(key)||'null');if(valid(s))return {token:s.token,expiresAt:s.expiresAt};}catch(_){}clear();return null;},write(s){if(!valid(s)){clear();return false;}try{getStorage().setItem(key,JSON.stringify({token:s.token,expiresAt:s.expiresAt}));return true;}catch(_){return false;}}};
}
