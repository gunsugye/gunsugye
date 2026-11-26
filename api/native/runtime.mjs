import {createSheetStore} from '../../scripts/supabase-sheet-compat.mjs';
import {nativeUtilities,requestDate} from './utilities.mjs';
const profiles=new Map(),sheetCache=new Map();
let cacheBytes=0;

// Deterministic read planning: no database mutation is committed during a planning pass.
// Even business code that catches a missing read cannot turn it into an empty result.
export async function executeBusiness({actor,manifest,runtime={},rpc,createBusiness,invoke,google,now=Date.now(),maxPasses=80}){
 const loaded=new Map(),memo=new Map(),ids=[],needed=new Map();let fatal;
 const profileKey=manifest.id+':'+actor.method+':'+String(actor.method==='readCompressedV282'?actor.args?.[0]:'');
 const cacheKey=(book,sheet)=>manifest.id+':'+book+':'+sheet+':'+manifest.books.find(b=>b.id===book)?.sheets.find(s=>s.id===sheet)?.revision;
 const remember=(book,sheet,data)=>{loaded.set(book+':'+sheet,data);const key=cacheKey(book,sheet),bytes=JSON.stringify(data).length*2;
  if(bytes>4000000)return;while(cacheBytes+bytes>24000000&&sheetCache.size){const first=sheetCache.keys().next().value;cacheBytes-=sheetCache.get(first).bytes;sheetCache.delete(first);}
  if(sheetCache.has(key))cacheBytes-=sheetCache.get(key).bytes;sheetCache.set(key,{data,bytes,until:now+30000});cacheBytes+=bytes;
 };
 const preload=(profiles.get(profileKey)||[]).filter(s=>manifest.books.find(b=>b.id===s.book)?.sheets.some(t=>t.id===s.sheet));
 const missing=[];for(const s of preload){const cached=sheetCache.get(cacheKey(s.book,s.sheet));if(cached&&cached.until>now)loaded.set(s.book+':'+s.sheet,cached.data);else missing.push(s);}
 async function loadSheets(requested){
  const expected=new Map(requested.map(s=>[s.book+':'+s.sheet,s]));
  const response=await rpc({action:'read',sheets:requested});
  if(!Array.isArray(response))throw Error('데이터 시트 조회 응답을 확인할 수 없습니다.');
  for(const row of response){
   const key=row?.book+':'+row?.sheet;
   if(!expected.has(key)||!row.data)throw Error('데이터 시트 조회 응답을 확인할 수 없습니다.');
   expected.delete(key);remember(row.book,row.sheet,row.data);
  }
  if(expected.size)throw Error('데이터 시트를 모두 불러오지 못했습니다.');
 }
 if(missing.length)await loadSheets(missing);
 const clone=v=>JSON.parse(JSON.stringify(v));
 function read(key,input){if(memo.has(key))return memo.get(key);needed.set(key,input);const error=Error('Native read pending');throw error;}
 for(let pass=0;pass<maxPasses;pass++){
  needed.clear();fatal=null;
  const settings=clone(manifest.settings),initial={...settings,...runtime,SUPABASE_STORE_MODE:'supabase'},propsData={...initial},cache=new Map(),attachments=[];
  const utilities=nativeUtilities(ids,now);
  const props={getProperty:k=>propsData[k]??null,getProperties:()=>({...propsData}),setProperty(k,v){propsData[k]=String(v);return props;},deleteProperty(k){delete propsData[k];return props;},setProperties(values,remove){if(remove)throw Error('전체 설정 삭제는 지원하지 않습니다.');for(const[k,v]of Object.entries(values))props.setProperty(k,v);return props;}};
  const cacheApi={get:k=>cache.get(k)??null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k),getAll:keys=>Object.fromEntries(keys.filter(k=>cache.has(k)).map(k=>[k,cache.get(k)])),putAll:data=>Object.entries(data).forEach(([k,v])=>cache.set(k,v)),removeAll:keys=>keys.forEach(k=>cache.delete(k))};
  const store=createSheetStore(manifest,(book,sheet)=>{
   const key=book+':'+sheet;if(loaded.has(key))return loaded.get(key);
   const cached=sheetCache.get(cacheKey(book,sheet));if(cached&&cached.until>now){loaded.set(key,cached.data);return cached.data;}
   needed.set(key,{action:'read',book,sheet});throw Error('Native read pending');
  },{newId:()=>Number.parseInt(utilities.getUuid().replaceAll('-','').slice(0,7),16),onUnsupported:e=>fatal=e,formatDate:utilities.formatDate});
  const unsupported=operation=>{fatal=Error('독립 서버에서 아직 지원하지 않는 기능: '+operation);fatal.pagesCode='NATIVE_UNSUPPORTED';throw fatal;};
  const external=google?.beginPass({onUnsupported:e=>fatal=e,formatDate:utilities.formatDate});
  const spreadsheet={openById:id=>store.hasBook(id)?store.openById(id):external?.openById(id)||unsupported('external spreadsheet'),openByUrl:url=>spreadsheet.openById(String(url).match(/\/d\/([\w-]+)/)?.[1]),flush(){},create:()=>unsupported('spreadsheet export')};
  const drive={getFileById:id=>{const a=attachments.find(a=>a.id===id)||read('attachment:'+id,{action:'attachment',id});return {getId:()=>id,getName:()=>a.name,getBlob:()=>utilities.newBlob(a.content,'application/json')};},createFile(name,content,type){if(type!=='application/json')return unsupported('file export');const a={id:'sb_'+utilities.getUuid(),name,content:String(content)};attachments.push(a);return {getId:()=>a.id};}};
  // Virtual triggers are configuration only; execution is owned by the native scheduler.
  const triggers=[];
  const script={getProjectTriggers:()=>triggers,deleteTrigger:()=>unsupported('trigger removal'),newTrigger:name=>{const t={getHandlerFunction:()=>name};for(const key of ['timeBased','everyMinutes','everyHours','everyDays','atHour','nearMinute','forForm','onFormSubmit','forSpreadsheet','onEdit','onChange'])t[key]=()=>t;t.create=()=>unsupported('scheduler registration: '+name);return t;},requireAllScopes(){},AuthMode:{FULL:'FULL'},getOAuthToken:()=>unsupported('Google OAuth')};
  const lock={waitLock(){},tryLock:()=>true,releaseLock(){}};
  const context={transactional:true,spreadsheet,properties:{getScriptProperties:()=>props},drive,cache:{getScriptCache:()=>cacheApi,getUserCache:()=>cacheApi},wrap:api=>api};
  const services={Utilities:utilities,Date:requestDate(now),LockService:{getScriptLock:()=>lock,getUserLock:()=>lock},ScriptApp:script,Session:{getScriptTimeZone:()=> 'Asia/Seoul'},UrlFetchApp:{fetch:()=>unsupported('Google HTTP')},FormApp:new Proxy({},{get:()=>unsupported('Google Forms')}),HtmlService:{createHtmlOutputFromFile:()=>unsupported('server HTML')},pagesStorageRpc_:input=>read(JSON.stringify(input),input),pagesNativeFormBook_:book=>external?.openById(book.getId())||unsupported('native Google spreadsheet')};
  let result,error;
  try{result=invoke(createBusiness(actor,context,services),props);}catch(e){error=e;}
  if(needed.size||google?.pending){
   const reads=[...needed].filter(([,v])=>v.action==='read');
   if(reads.length)await loadSheets(reads.map(([,v])=>({book:v.book,sheet:v.sheet})));
   for(const[key,input]of needed)if(input.action!=='read')memo.set(key,await rpc(input));
   if(google?.pending)await google.resolve();
   continue;
  }
  if(fatal)throw fatal;if(error)throw error;google?.assertReadOnly();
  const runtimeKey=k=>/^(PAGES_(?:PERSONAL_)?SESSION_|NATIVE_)/.test(k);
  const edits=[...new Set([...Object.keys(initial),...Object.keys(propsData)])].filter(k=>initial[k]!==propsData[k]).map(key=>({key,before:initial[key]??null,after:propsData[key]??null}));
  const payload={changes:store.changes(),schema:store.schema(),books:store.bookChanges(),settings:edits.filter(e=>!runtimeKey(e.key)),runtime:edits.filter(e=>runtimeKey(e.key)),attachments};
  if(Object.values(payload).some(list=>list.length))await rpc({action:'app-commit',request:actor.nonce,actor:actor.email,method:actor.method,payload});
  if(profiles.size>=128)profiles.delete(profiles.keys().next().value);
  profiles.set(profileKey,[...loaded.keys()].map(key=>{const at=key.lastIndexOf(':');return {book:key.slice(0,at),sheet:Number(key.slice(at+1))};}).slice(0,80));
  return {result,metrics:{passes:pass+1,sheets:loaded.size}};
 }
 throw Error('조회 계획 한도를 초과했습니다.');
}
