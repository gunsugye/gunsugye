// Local synthetic concurrency smoke test only: no network, database or real users.
import {performance} from 'node:perf_hooks';
import {executeBusiness} from '../api/native/runtime.mjs';
import {dispatch} from '../api/native/dispatch.mjs';
const total=800,results=new Map(),times=[];
const delay=()=>new Promise(resolve=>setTimeout(resolve,1));
const pass=async i=>{
 const started=performance.now(),name='synthetic-'+i,credential='secret-'+i;
 const actor={email:'personal@portal.invalid',sub:'personal-login',method:'pagesPersonalLogin',args:[{name,credential}]};
 const login=dispatch(actor,{personal:(action,input)=>{if(action!=='login'||input.name!==name||input.credential!==credential)throw Error('auth');return {id:name};}},{},()=>'',Date.now());
 await delay();
 const values=['id','old'],manifest={id:'simulation-'+i,settings:{},attachments:[],books:[{id:'b',sheets:[{id:1,title:'items',revision:0,columns:1,rows:2}]}]};
 const data={columns:1,revision:0,payload:values.map((v,n)=>({number:n+1,values:[v],display:[v],formulas:[''],formats:['General'],dates:[]}))};
 const outcome=await executeBusiness({actor:{nonce:crypto.randomUUID(),email:name,method:'save'},manifest,rpc:async input=>{await delay();if(input.action==='read')return [{book:'b',sheet:1,data}];if(input.action!=='app-commit'||results.has(name))throw Error('duplicate');const edit=input.payload.changes[0]?.edits?.[0];if(edit?.before?.values[0]!=='old'||edit.after.values[0]!==name)throw Error('bad change');results.set(name,edit.after.values[0]);return {ok:true};},createBusiness:(a,ctx)=>({run(){ctx.spreadsheet.openById('b').getSheetByName('items').getRange(2,1).setValue(login.id);return true;}}),invoke:api=>api.run()});
 times.push(performance.now()-started);return outcome.result;
};
const start=performance.now(),done=await Promise.allSettled(Array.from({length:total},(_,i)=>pass(i))),elapsed=performance.now()-start;
times.sort((a,b)=>a-b);console.log(JSON.stringify({scenario:'in-process mocked auth and database',users:total,successful:done.filter(x=>x.status==='fulfilled').length,failed:done.filter(x=>x.status==='rejected').length,saved:results.size,totalMs:Math.round(elapsed),p50Ms:Math.round(times[Math.floor(times.length*.5)]||0),p95Ms:Math.round(times[Math.floor(times.length*.95)]||0),p99Ms:Math.round(times[Math.floor(times.length*.99)]||0),networkOrSupabaseTested:false}));
if(done.some(x=>x.status==='rejected')||results.size!==total)process.exitCode=1;
