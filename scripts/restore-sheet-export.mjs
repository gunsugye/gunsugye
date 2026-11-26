import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {parseCsv,validateExport} from './validate-sheet-export.mjs';
process.on('unhandledRejection',e=>{console.error(JSON.stringify({error:'복구 요청을 완료하지 못했습니다.',status:e.response?.status,code:e.code}));process.exitCode=1;});

const path='.deploy/supabase-sheet-export.csv',journalPath='.deploy/supabase-sheet-restore.json';
const raw=readFileSync(path,'utf8'),summary=validateExport(raw),hash=createHash('sha256').update(raw).digest('hex');
const records=parseCsv(raw),headers=records.shift(),books=new Map();
for(const cols of records){if(!cols.some(Boolean))continue;const r=Object.fromEntries(headers.map((h,i)=>[h,cols[i]]));
 if(!books.has(r.book_id))books.set(r.book_id,{id:r.book_id,metadata:JSON.parse(r.book_metadata),sheets:new Map()});
 const book=books.get(r.book_id);if(!book.sheets.has(r.sheet_id))book.sheets.set(r.sheet_id,{id:Number(r.sheet_id),title:r.title,position:Number(r.position),columns:Number(r.columns_count),rows:[]});
 book.sheets.get(r.sheet_id).rows.push(...JSON.parse(r.payload));
}
for(const b of books.values())for(const s of b.sheets.values()){
 s.rows.sort((a,b)=>a.number-b.number);s.width=Math.max(1,s.columns,...s.rows.map(r=>r.values.length));s.height=Math.max(1,...s.rows.map(r=>r.number));
 if(s.width>18278||s.rows.some(r=>r.values.some(v=>typeof v==='string'&&v.length>50000)))throw Error('시트 셀의 크기가 Google Sheets 한도를 초과합니다.');
}
const sizes=[...books.values()].map(b=>({title:b.metadata.title,sheets:b.sheets.size,rows:[...b.sheets.values()].reduce((n,s)=>n+s.rows.length,0),cells:[...b.sheets.values()].reduce((n,s)=>n+s.width*s.height,0)}));
if(sizes.some(b=>b.cells>10000000))throw Error('파일의 셀 수가 Google Sheets 한도를 초과합니다.');
if(process.argv.includes('--check')){console.log(JSON.stringify({summary,files:sizes}));process.exit(0);}

const creds=JSON.parse(readFileSync('.deploy/google-native-credentials.json','utf8'));
if(creds.email!=='gunsugye@gmail.com'||creds.project_id!=='gunsugyedaily')throw Error('군수계 인증을 확인하세요.');
const auth=new OAuth2Client(creds.client_id,creds.client_secret);auth.setCredentials({refresh_token:creds.refresh_token});
const profile=(await auth.request({url:'https://openidconnect.googleapis.com/v1/userinfo',timeout:20000,retry:false})).data;
if(profile.email!=='gunsugye@gmail.com'||profile.email_verified!==true)throw Error('군수계 계정이 아닙니다.');
const journal=existsSync(journalPath)?JSON.parse(readFileSync(journalPath,'utf8')):{hash,revision:summary.revision,files:{}};
if(journal.hash!==hash)throw Error('이전 복구 작업의 내보내기 파일과 다릅니다.');
const save=()=>writeFileSync(journalPath,JSON.stringify(journal,null,2),{mode:0o600});
const request=async(url,data)=> (await auth.request({url,method:'POST',data,timeout:60000,retry:false})).data;
function cells(row){return row.values.map((v,i)=>{
 if((row.dates||[]).includes(i))return row.display?.[i]??String(v??'');
 return v===null||v===undefined?'':v;
});}
for(const book of books.values()){
 let state=journal.files[book.id];
 if(!state){
  // Mark intent first: an ambiguous timeout must never silently create duplicates.
  journal.files[book.id]={state:'creating'};save();
  const sheets=[...book.sheets.values()].sort((a,b)=>a.position-b.position).map(s=>({properties:{sheetId:s.id,title:s.title,gridProperties:{rowCount:s.height,columnCount:s.width}}}));
  const created=await request('https://sheets.googleapis.com/v4/spreadsheets',{properties:{title:(book.metadata.title||'군수계 자료')+' · Supabase 복구본 v'+summary.revision,timeZone:book.metadata.timeZone||'Asia/Seoul',locale:book.metadata.locale||'ko_KR'},sheets});
  state=journal.files[book.id]={state:'writing',id:created.spreadsheetId,url:created.spreadsheetUrl,done:[]};save();
 }
 if(state.state==='creating')throw Error('파일 생성 결과를 확인해야 합니다. Google Drive에서 중복 파일 여부를 확인하세요.');
 const done=new Set(state.done||[]);
 for(const sheet of [...book.sheets.values()].sort((a,b)=>a.position-b.position)){
  const ranges=[];let group=[];
  const flush=()=>{if(!group.length)return;const start=group[0].number;const values=group.map(cells);ranges.push({range:"'"+sheet.title.replaceAll("'","''")+"'!A"+start,values});group=[];};
  for(const row of sheet.rows){if(group.length&&(row.number!==group.at(-1).number+1||group.length>=100))flush();group.push(row);}flush();
  const remaining=ranges.map((data,i)=>({key:sheet.id+':'+i,data})).filter(x=>!done.has(x.key));
  while(remaining.length){
   const batch=[];let bytes=0;
   while(remaining.length&&batch.length<40){const candidate=remaining[0],size=Buffer.byteLength(JSON.stringify(candidate.data));if(batch.length&&bytes+size>1500000)break;batch.push(remaining.shift());bytes+=size;}
   for(let attempt=0;;attempt++)try{
    await request('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(state.id)+'/values:batchUpdate',{valueInputOption:'RAW',data:batch.map(x=>x.data)});break;
   }catch(error){if(error.response?.status!==429||attempt>=3)throw error;await new Promise(resolve=>setTimeout(resolve,30000));}
   batch.forEach(x=>done.add(x.key));state.done=[...done];save();
  }
  console.log(JSON.stringify({file:book.metadata.title,sheet:sheet.title,rows:sheet.rows.length}));
 }
 state.state='written';save();
}
console.log(JSON.stringify({ok:true,revision:summary.revision,files:Object.values(journal.files).map(f=>({url:f.url,state:f.state}))}));
