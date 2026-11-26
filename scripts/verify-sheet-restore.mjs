import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';
import {parseCsv,validateExport} from './validate-sheet-export.mjs';
process.on('unhandledRejection',e=>{console.error(JSON.stringify({error:'복구 데이터 검증 실패',status:e.response?.status,code:e.code}));process.exitCode=1;});
const raw=readFileSync('.deploy/supabase-sheet-export.csv','utf8'),summary=validateExport(raw),journal=JSON.parse(readFileSync('.deploy/supabase-sheet-restore.json','utf8'));
if(journal.hash!==createHash('sha256').update(raw).digest('hex'))throw Error('복구 파일이 다릅니다.');
const csv=parseCsv(raw),headers=csv.shift(),books=new Map();
for(const cols of csv){if(!cols.some(Boolean))continue;const r=Object.fromEntries(headers.map((h,i)=>[h,cols[i]]));if(!books.has(r.book_id))books.set(r.book_id,new Map());const book=books.get(r.book_id);if(!book.has(r.sheet_id))book.set(r.sheet_id,{id:Number(r.sheet_id),title:r.title,rows:[]});book.get(r.sheet_id).rows.push(...JSON.parse(r.payload));}
const c=JSON.parse(readFileSync('.deploy/google-native-credentials.json','utf8')),auth=new OAuth2Client(c.client_id,c.client_secret);auth.setCredentials({refresh_token:c.refresh_token});
const norm=arr=>{const out=arr.map(v=>v===null||v===undefined?'':v);while(out.length&&out.at(-1)==='')out.pop();return out;};
let sheets=0,rows=0,mismatches=0;
for(const [bookId,book]of books){const state=journal.files[bookId];if(!state||state.state!=='written')throw Error('완료되지 않은 파일이 있습니다.');
 const tabs=[...book.values()];for(let at=0;at<tabs.length;at+=10){const subset=tabs.slice(at,at+10),params=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE'});for(const tab of subset)params.append('ranges',"'"+tab.title.replaceAll("'","''")+"'");
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(state.id)+'/values:batchGet?'+params;
  const result=(await auth.request({url,timeout:60000,retry:false})).data.valueRanges||[];if(result.length!==subset.length)throw Error('검증 대상 탭이 누락됐습니다.');
  subset.forEach((tab,i)=>{sheets++;const values=result[i].values||[];for(const row of tab.rows){rows++;const expected=row.values.map((v,j)=>(row.dates||[]).includes(j)?row.display?.[j]??String(v??''):v);if(JSON.stringify(norm(expected))!==JSON.stringify(norm(values[row.number-1]||[])))mismatches++;}});
 }
}
console.log(JSON.stringify({revision:summary.revision,files:books.size,sheets,rows,mismatches}));if(sheets!==summary.sheets||rows!==summary.rows||mismatches)process.exitCode=1;
