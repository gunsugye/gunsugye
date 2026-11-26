import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Strict RFC 4180 reader: an incomplete quoted field must never pass validation.
export function parseCsv(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else field+=c;continue;}
  if(closed&&c!==','&&c!=='\r'&&c!=='\n')throw Error('CSV 따옴표 형식이 올바르지 않습니다.');
  if(c==='"'){if(field)throw Error('CSV 필드 형식이 올바르지 않습니다.');quoted=true;continue;}
  if(c===','){row.push(field);field='';closed=false;continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';closed=false;continue;}
  field+=c;
 }
 if(quoted)throw Error('CSV 파일이 중간에 잘렸습니다.');
 if(row.length||field||closed){row.push(field);rows.push(row);}
 return rows;
}
export function validateExport(text){
 const csv=parseCsv(text),headers=csv.shift(),required=['revision','expected_books','expected_sheets','expected_rows','book_id','book_metadata','sheet_id','title','position','columns_count','rows_count','sheet_revision','chunk','chunk_rows','payload'];
 if(!headers||new Set(headers).size!==headers.length||required.some(k=>!headers.includes(k)))throw Error('내보낸 CSV의 열을 확인하세요.');
 const records=csv.filter(r=>r.some(Boolean)).map(r=>{if(r.length!==headers.length)throw Error('CSV 행의 열 수가 맞지 않습니다.');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));});
 if(!records.length)throw Error('내보낸 기록이 없습니다.');
 const expected=required.slice(0,4).map(k=>records[0][k]);
 if(records.some(r=>required.slice(0,4).some((k,i)=>r[k]!==expected[i])))throw Error('서로 다른 저장 버전이 섞였습니다.');
 const books=new Map(),sheets=new Map();let rowCount=0;
 for(const r of records){
  const id=r.book_id+'\u0000'+r.sheet_id,metadata=JSON.parse(r.book_metadata),payload=JSON.parse(r.payload),count=Number(r.chunk_rows);
  if(!Array.isArray(payload)||payload.length!==count)throw Error('기록 묶음의 행 수가 다릅니다.');
  if(books.has(r.book_id)&&books.get(r.book_id)!==r.book_metadata)throw Error('파일 메타데이터가 다릅니다.');books.set(r.book_id,r.book_metadata);
  const signature=JSON.stringify([r.title,r.position,r.columns_count,r.rows_count,r.sheet_revision]);
  if(!sheets.has(id))sheets.set(id,{bookId:r.book_id,sheetId:r.sheet_id,title:r.title,metadata,signature,chunks:new Set(),rows:new Set()});
  const sh=sheets.get(id);if(sh.signature!==signature||sh.chunks.has(r.chunk))throw Error('탭 정보 또는 묶음이 중복됩니다.');sh.chunks.add(r.chunk);
  for(const p of payload){if(!Number.isInteger(p.number)||p.number<1||sh.rows.has(p.number)||!Array.isArray(p.values))throw Error('기록 번호 또는 셀 형식이 올바르지 않습니다.');sh.rows.add(p.number);rowCount++;}
 }
 if(books.size!==Number(expected[1])||sheets.size!==Number(expected[2])||rowCount!==Number(expected[3]))throw Error('다운로드된 파일이 전체 자료와 일치하지 않습니다.');
 return {revision:Number(expected[0]),books:books.size,sheets:sheets.size,rows:rowCount};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(validateExport(readFileSync(process.argv[2]||'.deploy/supabase-sheet-export.csv','utf8'))));}catch(e){console.error(e.message);process.exitCode=1;}
}
