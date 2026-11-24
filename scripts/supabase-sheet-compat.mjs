/** In-memory workbook compatibility layer. Reads are lazy; writes produce an atomic DB patch.
 * No production routing is enabled here. Unknown operations fail rather than silently lose data.
 */
export function createSheetStore(manifest, readSheet, options={}) {
 const clone=v=>JSON.parse(JSON.stringify(v)),books=new Map(),loaded=new Map(),schema=new Map(),bookEdits=[];
 manifest=clone(manifest);
 const fail=message=>{const e=Error(message);options.onUnsupported?.(e);throw e;};
 const guarded=(obj,label)=>new Proxy(obj,{get(target,prop){if(prop in target||typeof prop==='symbol'||prop==='then'||prop==='toJSON')return target[prop];return fail('Unsupported '+label+' operation: '+String(prop));}});
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function column(s){return [...s.toUpperCase()].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);}
 function rangeSpec(sheet,args){
  if(typeof args[0]==='string'){
   const m=/^\$?([A-Z]+)(\d+)?(?::\$?([A-Z]+)(\d+)?)?$/i.exec(args[0]);if(!m)throw Error('Unsupported range: '+args[0]);
   const c=column(m[1]),r=Number(m[2]||1),endC=column(m[3]||m[1]),endR=Number(m[4]||m[2]||sheet.getMaxRows());return [r,c,endR-r+1,endC-c+1];
  }
  const [r,c,h=1,w=1]=args;if(![r,c,h,w].every(n=>Number.isInteger(n)&&n>0))throw Error('Invalid cell range');return [r,c,h,w];
 }
 function load(book,meta){
  const key=book.id+':'+meta.id;if(loaded.has(key))return loaded.get(key);
  const data=meta.created?{payload:[],columns:0,revision:0}:readSheet(book.id,meta.id);if(!data)throw Error('Missing database sheet');
  const original=clone(data.payload),rows=clone(data.payload);let width=data.columns,structural=false,maxRows=Math.max(1000,rows.length),maxColumns=Math.max(26,width);
  const empty=n=>({number:n,values:Array(width).fill(''),display:Array(width).fill(''),formulas:Array(width).fill(''),formats:Array(width).fill('General'),dates:[]});
  function rowAt(n,create=false){if(create)while(rows.length<n)rows.push(empty(rows.length+1));return rows[n-1]||empty(n);}
  const populated=row=>row.values.some((v,i)=>v!==''&&v!==null&&v!==undefined||!!row.formulas[i]);
  const lastRow=()=>{for(let i=rows.length-1;i>=0;i--)if(populated(rows[i]))return i+1;return 0;};
  const lastCol=()=>rows.reduce((m,row)=>Math.max(m,...row.values.map((v,i)=>v!==''&&v!==null&&v!==undefined||row.formulas[i]?i+1:0)),0);
  const get=(n,c,kind)=>rowAt(n)[kind]?.[c-1]??'';
  const decoded=(n,c)=>{const row=rowAt(n);return row.dates.includes(c-1)?new Date(row.values[c-1]):row.values[c-1]??'';};
  function set(n,c,value){
   if(value===undefined||value===null)value='';if(!(value instanceof Date)&&!['string','number','boolean'].includes(typeof value))throw Error('Unsupported cell value');
   if(typeof value==='number'&&!Number.isFinite(value))throw Error('Invalid numeric value');
   const literal=typeof value==='string'&&value.startsWith("'");if(literal)value=value.slice(1);if(!literal&&typeof value==='string'&&value.startsWith('='))return fail('Formula evaluation needs native Sheets');
   const row=rowAt(n,true);while(row.values.length<c){row.values.push('');row.display.push('');row.formulas.push('');row.formats.push('General');}
   row.dates=row.dates.filter(i=>i!==c-1);row.formulas[c-1]='';
   if(value instanceof Date){row.values[c-1]=value.toISOString();row.display[c-1]=options.formatDate?options.formatDate(value,book.timeZone,row.formats[c-1]):value.toISOString();row.dates.push(c-1);}
   else {row.values[c-1]=value;row.display[c-1]=typeof value==='boolean'?(value?'TRUE':'FALSE'):String(value);}
   width=Math.max(width,c);maxColumns=Math.max(maxColumns,c);maxRows=Math.max(maxRows,n);
  }
  function range(...args){const [r,c,h,w]=rangeSpec(sheet,args);
   const grid=fn=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>fn(r+i,c+j)));
   const out={getRow:()=>r,getColumn:()=>c,getNumRows:()=>h,getNumColumns:()=>w,getSheet:()=>sheet,
    getValues:()=>grid(decoded),getDisplayValues:()=>grid((i,j)=>get(i,j,'display')),getFormulas:()=>grid((i,j)=>get(i,j,'formulas')),getNumberFormats:()=>grid((i,j)=>get(i,j,'formats')),
    getValue:()=>decoded(r,c),getDisplayValue:()=>get(r,c,'display'),
    setValues(values){if(!Array.isArray(values)||values.length!==h||values.some(v=>!Array.isArray(v)||v.length!==w))throw Error('Cell dimensions differ');values.forEach((v,i)=>v.forEach((x,j)=>set(r+i,c+j,x)));return out;},
    setValue(value){for(let i=0;i<h;i++)for(let j=0;j<w;j++)set(r+i,c+j,value);return out;},
    clearContent(){return out.setValues(grid(()=>''));},clear(){return out.clearContent();},
    setNumberFormat(format){for(let i=0;i<Math.min(h,rows.length-r+1);i++)for(let j=0;j<w;j++){const row=rowAt(r+i);while(row.formats.length<c+j)row.formats.push('General');row.formats[c+j-1]=format;if(row.dates.includes(c+j-1)&&options.formatDate)row.display[c+j-1]=options.formatDate(new Date(row.values[c+j-1]),book.timeZone,format);}return out;},
    createTextFinder(text){let entire=false,matchCase=false,regex=false;const finder={matchEntireCell(v){entire=v;return finder;},matchCase(v){matchCase=v;return finder;},useRegularExpression(v){regex=v;return finder;},findAll(){const found=[];const want=matchCase?String(text):String(text).toLowerCase();for(let i=0;i<h;i++)for(let j=0;j<w;j++){let actual=String(get(r+i,c+j,'display'));if(!matchCase)actual=actual.toLowerCase();const match=regex?new RegExp(entire?'^(?:'+text+')$':text,matchCase?'':'i').test(actual):entire?actual===want:actual.includes(want);if(match)found.push(range(r+i,c+j));}return found;},findNext(){return finder.findAll()[0]||null;}};return finder;}
   };
   // Formatting is presentation-only in the existing app; preserve stored formats where read.
   for(const name of ['setFontWeight','setBackground','setFontColor','setFontFamily','setFontSize','setVerticalAlignment','setWrap','setWrapStrategy','setDataValidation','setDataValidations'])out[name]=()=>out;
   return guarded(out,'database range');
  }
  function renumber(){rows.forEach((row,i)=>row.number=i+1);structural=true;}
  const sheet={getSheetId:()=>meta.id,getName:()=>meta.title,getLastRow:lastRow,getLastColumn:lastCol,getMaxRows:()=>maxRows,getMaxColumns:()=>maxColumns,getFormUrl:()=>meta.formUrl||null,getParent:()=>books.get(book.id),getIndex:()=>book.sheets.indexOf(meta)+1,
   getDataRange:()=>range(1,1,Math.max(1,lastRow()),Math.max(1,lastCol())),getRange:range,
   appendRow(values){range(lastRow()+1,1,1,values.length).setValues([values]);return sheet;},
   setName(title){if(!title||book.sheets.some(s=>s!==meta&&s.title===title))throw Error('Duplicate or empty sheet name');meta.title=String(title);const old=schema.get(key);schema.set(key,old?.op==='create'?{...old,title:meta.title}:{op:'rename',book:book.id,sheet:meta.id,title:meta.title,revision:data.revision});return sheet;},
   clear(){if(rows.length){rows.length=0;structural=true;}return sheet;},clearContents(){return sheet.clear();},
   copyTo(target){const copy=target.insertSheet('Copy '+meta.title+' '+(options.newId?.()||Date.now()));const count=lastRow(),cols=lastCol();if(count&&cols){const source=range(1,1,count,cols);copy.getRange(1,1,count,cols).setValues(source.getValues());}return copy;},
   deleteRows(at,count){if(!Number.isInteger(count)||count<1||at<1||at+count-1>maxRows)throw Error('Invalid delete range');if(at<=rows.length){rows.splice(at-1,count);renumber();}maxRows-=count;return sheet;},deleteRow(at){return sheet.deleteRows(at,1);},
   insertRowsBefore(at,count){if(at<1||at>maxRows||!Number.isInteger(count)||count<1)throw Error('Invalid insert range');if(at<=rows.length){rows.splice(at-1,0,...Array.from({length:count},()=>empty(0)));renumber();}maxRows+=count;return sheet;},
   insertRowBefore(at){return sheet.insertRowsBefore(at,1);},insertRowsAfter(at,count){if(at===maxRows){maxRows+=count;return sheet;}return sheet.insertRowsBefore(at+1,count);},
   insertColumnsAfter(at,count){if(at!==maxColumns)throw Error('Inserting populated columns is not supported');maxColumns+=count;return sheet;},
   getFilter:()=>null,getBandings:()=>[],getProtections:()=>[],protect(){const p={getDescription:()=>'',getEditors:()=>[],canDomainEdit:()=>false};for(const name of ['setDescription','setWarningOnly','addEditor','addEditors','removeEditor','removeEditors','setDomainEdit','setUnprotectedRanges','remove'])p[name]=()=>p;return p;},
   patch(){if(meta.deleted)return null;const edits=[];for(let i=0;i<Math.min(rows.length,original.length);i++)if(!same(rows[i],original[i]))edits.push({number:i+1,before:original[i],after:clone(rows[i])});if(!structural&&!edits.length&&rows.length===original.length)return null;
    return structural?{book:book.id,sheet:meta.id,columns:width,revision:data.revision,mode:'replace',rows:clone(rows)}:{book:book.id,sheet:meta.id,columns:width,mode:'patch',edits,append:clone(rows.slice(original.length))};}
  };
  for(const name of ['setFrozenRows','setFrozenColumns','setHiddenGridlines','autoResizeColumns','autoResizeRows','hideColumns','setColumnWidth','setColumnWidths','setConditionalFormatRules'])sheet[name]=()=>sheet;
  loaded.set(key,sheet);return sheet;
 }
 function registerBook(book){const originalBook=clone(book);delete originalBook.sheets;
  const editBook=()=>{const after=clone(book);delete after.sheets;const index=bookEdits.findIndex(e=>e.id===book.id),entry={id:book.id,before:index>=0?bookEdits[index].before:originalBook,after};if(index<0)bookEdits.push(entry);else bookEdits[index]=entry;};
  const obj={getId:()=>book.id,getName:()=>book.title,getUrl:()=> 'https://docs.google.com/spreadsheets/d/'+book.id+'/edit',getSpreadsheetLocale:()=>book.locale,getSpreadsheetTimeZone:()=>book.timeZone,
  setSpreadsheetLocale(v){book.locale=v;editBook();return obj;},setSpreadsheetTimeZone(v){book.timeZone=v;editBook();return obj;},
  getSheetByName(name){const meta=book.sheets.find(s=>!s.deleted&&s.title===name);return meta?proxy(meta):null;},getSheets:()=>book.sheets.filter(s=>!s.deleted).map(proxy),getSheetById:id=>{const m=book.sheets.find(s=>!s.deleted&&s.id===id);return m?proxy(m):null;},
  insertSheet(title){if(!title||book.sheets.some(s=>!s.deleted&&s.title===title))throw Error('Duplicate or empty sheet name');const id=options.newId?.()||Date.now()*1000+Math.floor(Math.random()*1000),meta={id,title:String(title),created:true,revision:0};book.sheets.push(meta);schema.set(book.id+':'+id,{op:'create',book:book.id,sheet:id,title:meta.title});return proxy(meta);},
  deleteSheet(sh){const meta=book.sheets.find(s=>s.id===sh.getSheetId()&&!s.deleted);if(!meta)throw Error('Sheet not found');if(book.sheets.filter(s=>!s.deleted).length===1)throw Error('Cannot delete last sheet');const data=load(book,meta);meta.deleted=true;const key=book.id+':'+meta.id;if(meta.created)schema.delete(key);else schema.set(key,{op:'delete',book:book.id,sheet:meta.id,revision:readSheet(book.id,meta.id).revision});}
 };
  // Merely finding a sheet does not fetch every row from the database.
  function proxy(meta){return new Proxy({getSheetId:()=>meta.id,getName:()=>meta.title,getFormUrl:()=>meta.formUrl||null},{get(target,prop){if(prop in target||typeof prop==='symbol'||prop==='then'||prop==='toJSON')return target[prop];const sheet=load(book,meta);if(!(prop in sheet))return fail('Unsupported database sheet operation: '+String(prop));return sheet[prop];}});}
  books.set(book.id,guarded(obj,'database book'));
 }
 manifest.books.forEach(registerBook);
 return {openById(id){if(!books.has(id))throw Error('Workbook not migrated');return books.get(id);},adoptBook(metadata){if(books.has(metadata.id))throw Error('Book already registered');const book=clone(metadata);book.sheets.forEach(s=>{s.created=true;s.revision=0;schema.set(book.id+':'+s.id,{op:'create',book:book.id,sheet:s.id,title:s.title});});registerBook(book);const after=clone(book);delete after.sheets;bookEdits.push({id:book.id,before:null,after});return books.get(book.id);},hasBook:id=>books.has(id),changes:()=>[...loaded.values()].map(s=>s.patch()).filter(Boolean),schema:()=>[...schema.values()],bookChanges:()=>clone(bookEdits)};
}
