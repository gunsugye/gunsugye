import test from 'node:test';
import assert from 'node:assert/strict';
import {executeBusiness} from '../api/native/runtime.mjs';
import {dispatch} from '../api/native/dispatch.mjs';
import {nativeUtilities} from '../api/native/utilities.mjs';
const manifest={settings:{},attachments:[],books:[{id:'b',sheets:[{id:1,title:'roster',revision:0,columns:1,rows:2}]}]};
const data={columns:1,revision:0,payload:[{number:1,values:['id'],display:['id'],formulas:[''],formats:['General'],dates:[]},{number:2,values:['old'],display:['old'],formulas:[''],formats:['General'],dates:[]}]};
test('a caught deferred read cannot commit partial writes; one complete commit follows planning',async()=>{
 const commits=[],ids=[];
 const result=await executeBusiness({actor:{nonce:crypto.randomUUID(),email:'a',method:'test'},manifest,rpc:async input=>{if(input.action==='read')return [{book:'b',sheet:1,data}];commits.push(input);return {};},createBusiness:(actor,ctx,svc)=>({run(){ids.push(svc.Utilities.getUuid());ctx.properties.getScriptProperties().setProperty('setting','value');try{ctx.spreadsheet.openById('b').getSheetByName('roster').getRange(2,1).setValue('new');}catch{}return 10;}}),invoke:api=>api.run()});
 assert.equal(result.result,10);assert.equal(result.metrics.passes,2);assert.equal(commits.length,1);assert.equal(ids[0],ids[1]);
 assert.equal(commits[0].payload.changes[0].edits[0].before.values[0],'old');assert.equal(commits[0].payload.changes[0].edits[0].after.values[0],'new');
});
test('unknown operations fail even when business code catches the error, with no commit',async()=>{
 await assert.rejects(executeBusiness({actor:{},manifest,rpc:()=>assert.fail('must not commit'),createBusiness:(actor,ctx,svc)=>({run(){try{svc.FormApp.openById('x');}catch{}return 'partial';}}),invoke:api=>api.run()}),/지원하지 않는 기능/);
});
test('missing or duplicate database sheet results fail immediately instead of repeatedly reading or committing',async()=>{
 for(const response of [[],[{book:'b',sheet:1,data},{book:'b',sheet:1,data}]]){
  let reads=0;
  await assert.rejects(executeBusiness({actor:{method:'readMissing'},manifest:{...manifest,id:'missing-'+crypto.randomUUID()},rpc:async input=>{assert.equal(input.action,'read');reads++;return response;},createBusiness:(actor,ctx)=>({run(){return ctx.spreadsheet.openById('b').getSheetByName('roster').getRange(1,1).getValue();}}),invoke:api=>api.run()}),/시트/);
  assert.equal(reads,1);
 }
});
test('admin session expiry and actor binding are enforced',()=>{
 const props={getProperty:()=>JSON.stringify({email:'a',sub:'s',expiresAt:20})},api={call:()=>1};
 assert.equal(dispatch({email:'a',sub:'s',sessionId:'id',method:'read',args:[]},api,props,()=>'',10),1);
 assert.throws(()=>dispatch({email:'b',sub:'s',sessionId:'id',method:'read',args:[]},api,props,()=>'',10),/로그인/);
 assert.throws(()=>dispatch({email:'a',sub:'s',sessionId:'id',method:'read',args:[]},api,props,()=>'',21),/로그인/);
});
test('native utility hashing, gzip, and Seoul dates retain existing wire formats',()=>{
 const u=nativeUtilities();const bytes=u.computeDigest('sha256','한글');assert.equal(u.base64EncodeWebSafe(bytes).length,44);assert.equal(u.base64EncodeWebSafe(bytes).replace(/=+$/,'').length,43);
 assert.equal(u.ungzip(u.gzip(u.newBlob('한글'))).getDataAsString(),'한글');
 assert.equal(u.formatDate(new Date('2026-11-25T05:00:01Z'),'Asia/Seoul','yyyy-MM-dd HH:mm:ss'),'2026-11-25 14:00:01');
 assert.equal(u.formatDate(new Date('2026-11-25T05:00:01Z'),'Asia/Seoul','General'),'2026-11-25 14:00:01');
});
