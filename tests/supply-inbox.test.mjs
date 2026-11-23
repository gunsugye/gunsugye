import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

function fixture(){
 const sheets=new Map(),props=new Map(),applied=[],triggers=[],person={id:'p1'},main={};
 const range=(sh,row,col,height=1,width=1)=>({
  getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>sh.rows[row+i-1]?.[col+j-1]??'')),
  getDisplayValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(sh.rows[row+i-1]?.[col+j-1]??''))),
  setValues:values=>{values.forEach((cells,i)=>cells.forEach((value,j)=>{sh.rows[row+i-1]??=[];sh.rows[row+i-1][col+j-1]=value;}));},
  setValue:value=>{sh.rows[row-1]??=[];sh.rows[row-1][col-1]=value;},
  createTextFinder:text=>({matchEntireCell:()=>({findNext:()=>{const i=sh.rows.findIndex((cells,index)=>index>=row-1&&String(cells?.[col-1])===text);return i<0?null:{getRow:()=>i+1};}})})
 });
 const sheet=name=>({name,rows:[],setName(next){sheets.delete(this.name);this.name=next;sheets.set(next,this);},getLastRow(){return this.rows.length;},getRange(row,col,height,width){return range(this,row,col,height,width);},appendRow(cells){this.rows.push(cells);}});
 const first=sheet('Sheet1');sheets.set(first.name,first);
 const book={getId:()=> 'inbox1',getUrl:()=> 'https://docs.google.com/spreadsheets/d/inbox1/edit',getSheets:()=>[...sheets.values()],getSheetByName:name=>sheets.get(name)||null,insertSheet:name=>{const sh=sheet(name);sheets.set(name,sh);return sh;}};
 const context=vm.createContext({Date,Map,Set,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},SpreadsheetApp:{create:()=>book,openById:id=>{assert.equal(id,'inbox1');return book;}},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased(){return this;},everyMinutes(){return this;},create(){triggers.push({getHandlerFunction:()=>name});}})},LockService:{getUserLock:()=>({waitLock(){},releaseLock(){}})},personalPersonV331_:()=>({person,ss:main}),supplySurveyPolicyV506_:()=>({mode:'direct',id:'survey1',label:'조사'}),supplyRegistryItems_:()=>[{id:'a'}],personalHashV330_:value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),iso_:()=>new Date().toISOString(),lockAndRun_:fn=>fn(),spreadsheet_:()=>main,rosterRequired_:()=>main,rosterRows_:()=>[person],supplyRequestOwnV506_:()=>({snapshot:'current'}),personalSupplyBatchV507_:(payload,details,policy,locked)=>{assert.equal(locked,true);applied.push({payload,details,policy});},referenceAdminV409_:()=>{}});
 vm.runInContext(readFileSync(new URL('../scripts/supply-inbox-server.gs.txt',import.meta.url),'utf8')+readFileSync(new URL('../scripts/supply-survey-lifecycle-server.gs.txt',import.meta.url),'utf8'),context);
 return {context,sheets,applied,triggers};
}

test('군수품 제출은 원본을 수정하지 않고 별도 시트에 한 번 접수한 뒤 후속 처리한다',()=>{
 const f=fixture(),payload={campaignId:'survey1',changes:[{itemId:'a',snapshot:'before',value:{status:'정상',detail:'',extra:{수량:'1'}}}]};
 const first=f.context.personalSupplyStageV542_(payload),again=f.context.personalSupplyStageV542_(payload);
 assert.equal(first.queued,true);assert.equal(first.receiptId,again.receiptId);assert.equal(f.sheets.get('전수조사_접수').rows.length,2);assert.equal(f.applied.length,0);assert.equal(f.triggers.length,1);
 assert.equal(f.context.getSupplyInboxV542().pending,1);
 assert.equal(f.context.supplyInboxProcessV542_().processed,1);assert.equal(f.applied.length,1);
 assert.equal(f.sheets.get('전수조사_접수').rows[1][2],'완료');assert.equal(f.context.getSupplyInboxV542().completed,1);
});
