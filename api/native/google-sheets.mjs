import {createSheetStore} from '../../scripts/supabase-sheet-compat.mjs';

// Google serial dates represent wall time in the spreadsheet's timezone.
function serialDate(serial,timeZone){
 const wall=Math.round((serial-25569)*86400000);let instant=wall;
 const format=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){
  const p=Object.fromEntries(format.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
  const rendered=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)+(instant%1000+1000)%1000;
  const delta=wall-rendered;if(!delta)break;instant+=delta;
 }
 return new Date(instant).toISOString();
}
export function sheetData(response,timeZone){
 const rows=[];let columns=0;
 for(const grid of response.sheets?.[0]?.data||[])for(let i=0;i<(grid.rowData||[]).length;i++){
  const number=(grid.startRow||0)+i+1;
  while(rows.length<number)rows.push({number:rows.length+1,values:[],display:[],formulas:[],formats:[],dates:[]});
  const row=rows[number-1];
  for(let j=0;j<(grid.rowData[i].values||[]).length;j++){
   const col=(grid.startColumn||0)+j,cell=grid.rowData[i].values[j],effective=cell.effectiveValue||{},format=cell.effectiveFormat?.numberFormat;
   while(row.values.length<=col){row.values.push('');row.display.push('');row.formulas.push('');row.formats.push('General');}
   row.values[col]=effective.numberValue??effective.boolValue??effective.stringValue??cell.formattedValue??'';
   row.display[col]=cell.formattedValue??String(row.values[col]);row.formulas[col]=cell.userEnteredValue?.formulaValue||'';row.formats[col]=format?.pattern||'General';
   if(['DATE','DATE_TIME','TIME'].includes(format?.type)&&typeof effective.numberValue==='number'){row.values[col]=serialDate(effective.numberValue,timeZone);row.dates.push(col);}
   if(row.values[col]!==''||row.formulas[col])columns=Math.max(columns,col+1);
  }
 }
 while(rows.length&&rows.at(-1).values.every((v,i)=>v===''&&!rows.at(-1).formulas[i]))rows.pop();
 return {payload:rows,columns,revision:0};
}

// Deferred synchronous reads let existing permission/business rules run unchanged.
// External writes are explicitly rejected until the export/sync adapters are ready.
export function createGoogleReadPlan(client){
 const books=new Map(),sheets=new Map(),pending=new Map();let store;
 function defer(key,fetcher){pending.set(key,fetcher);throw Error('Google read pending');}
 return {
  get pending(){return pending.size;},
  async resolve(){const jobs=[...pending.values()];pending.clear();await Promise.all(jobs.map(f=>f()));},
  beginPass(options={}){
   store=createSheetStore({books:[...books.values()]},(book,sheet)=>{
    const key=book+':'+sheet;if(sheets.has(key))return sheets.get(key);
    const meta=books.get(book),tab=meta.sheets.find(s=>s.id===sheet);
    return defer(key,async()=>{
     const value=await client.sheet(book,{includeGridData:'true',ranges:"'"+tab.title.replaceAll("'","''")+"'",fields:'sheets(data(startRow,startColumn,rowData(values(effectiveValue,formattedValue,userEnteredValue,effectiveFormat(numberFormat)))))'});
     sheets.set(key,sheetData(value,meta.timeZone));
    });
   },options);
   return {openById(id){
    if(!/^[\w-]{20,}$/.test(id))throw Error('Google 시트 ID를 확인하세요.');
    if(!books.has(id))return defer('book:'+id,async()=>{
     const data=await client.sheet(id,{fields:'spreadsheetId,properties(title,timeZone,locale),sheets(properties(sheetId,title,index,gridProperties))'});
     books.set(id,{id,title:data.properties.title,timeZone:data.properties.timeZone||'Asia/Seoul',locale:data.properties.locale,sheets:(data.sheets||[]).map(s=>({id:s.properties.sheetId,title:s.properties.title,position:s.properties.index,rows:s.properties.gridProperties?.rowCount||0,columns:s.properties.gridProperties?.columnCount||0,revision:0}))});
    });
    return store.openById(id);
   }};
  },
  assertReadOnly(){if(store&&(store.changes().length||store.schema().length||store.bookChanges().length))throw Object.assign(Error('Google 원본 쓰기 연결은 아직 준비되지 않았습니다.'),{pagesCode:'NATIVE_UNSUPPORTED'});}
 };
}
