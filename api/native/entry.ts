import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {executeBusiness} from './runtime.mjs';
import {dispatch,normalizeResponse} from './dispatch.mjs';
import {createBusiness} from './business.mjs';
import {createGoogleClient} from './google-client.mjs';
import {createGoogleReadPlan} from './google-sheets.mjs';

// Replaced only in private deployment staging. No browser can call this with a public key.
const digest='__SERVER_CREDENTIAL_SHA256__',dataset='__DATASET_UUID__';
const endpoint=Deno.env.get('SUPABASE_URL')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const googleClient=createGoogleClient({credentials:()=>JSON.parse(Deno.env.get('GOOGLE_NATIVE_CREDENTIALS')||'null')});
async function database(name:string,args:unknown){
 const res=await fetch(endpoint+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:serviceKey,authorization:'Bearer '+serviceKey,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(20000)});
 const data=await res.json();if(!res.ok){const error=Error(data.code==='PT409'?'다른 변경이 먼저 저장되었습니다. 다시 불러오세요.':'데이터베이스 요청을 처리하지 못했습니다.');Object.assign(error,{pagesCode:data.code==='PT409'?'CONFLICT':'DATABASE_ERROR'});throw error;}return data;
}
const rpc=(input:any)=>{
 if(input.action==='read')return database('logbook_read_sheets',{p_dataset:dataset,p_sheets:input.sheets});
 if(input.action==='attachment')return database('logbook_attachment',{p_dataset:dataset,p_id:input.id});
 if(input.action==='person-supplies')return database('logbook_person_supplies',{p_dataset:dataset,p_book:input.book,p_person:input.person,p_items:input.items});
 if(input.action==='app-commit')return database('logbook_app_commit',{p_dataset:dataset,p_request:input.request,p_actor:input.actor,p_method:input.method,p_payload:input.payload});
 throw Error('Unsupported native storage action');
};
Deno.serve(async request=>{
 const start=Date.now(),reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','server-timing':`native;dur=${Date.now()-start}`}});
 try{
  if(request.method!=='POST')return reply({ok:false},405);
  const secret=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!/^[a-f0-9]{64}$/.test(secret)||!timingSafeEqual(Buffer.from(createHash('sha256').update(secret).digest('hex')),Buffer.from(digest)))return reply({ok:false},401);
  if(Number(request.headers.get('content-length')||0)>13*1024*1024)return reply({ok:false},413);
  const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>13*1024*1024)return reply({ok:false},413);
  const actor=JSON.parse(raw);
  if(!Number.isFinite(actor.timestamp)||Math.abs(Date.now()-actor.timestamp)>90000||!/^[-a-f0-9]{36}$/.test(actor.nonce||'')||typeof actor.email!=='string'||typeof actor.sub!=='string'||!actor.sub||!/^\w+$/.test(actor.method||'')||!Array.isArray(actor.args)||actor.args.length>30)return reply({ok:false,code:'FORBIDDEN'},403);
  if(actor.method==='pagesPersonalLogin'){
   const name=String(actor.args[0]?.name||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();
   if(!await database('logbook_auth_attempt',{p_dataset:dataset,p_name:createHash('sha256').update(name).digest('hex'),p_ip:actor.rateKey}))return reply({ok:false,code:'RATE_LIMITED',error:'인증 시도가 많습니다. 15분 후 다시 시도하세요.'});
  }
  const {manifest,runtime}=await database('logbook_app_context',{p_dataset:dataset});
  const adminId=randomUUID();
  const output=await executeBusiness({actor,manifest,runtime,rpc,createBusiness,google:createGoogleReadPlan(googleClient),now:start,invoke:(api:any,props:any)=>dispatch(actor,api,props,()=>adminId,start)});
  return reply({ok:true,result:normalizeResponse(output.result)});
 }catch(error){return reply({ok:false,code:error.pagesCode||'APPLICATION_ERROR',error:String(error.message||error).slice(0,1000)});}
});
