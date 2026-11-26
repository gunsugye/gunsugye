import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleClient} from '../api/native/google-client.mjs';
import {createGoogleReadPlan,sheetData} from '../api/native/google-sheets.mjs';
import {executeBusiness} from '../api/native/runtime.mjs';
const credentials={project_id:'gunsugyedaily',email:'gunsugye@gmail.com',client_id:'client',client_secret:'secret',refresh_token:'refresh'};
test('Google requests share token refresh and retain tokens only server-side',async()=>{
 let refreshes=0;const urls=[];
 const client=createGoogleClient({credentials,fetcher:async(url,init)=>{
  if(url.includes('/token')){refreshes++;await new Promise(r=>setTimeout(r,5));return Response.json({access_token:'private',expires_in:3600});}
  assert.equal(init.headers.authorization,'Bearer private');assert.equal(init.redirect,'error');urls.push(url);return Response.json({});
 }});
 await Promise.all([client.form('a'),client.sheet('b')]);await client.form('c');
 assert.equal(refreshes,1);assert.equal(urls.length,3);
 await assert.rejects(client.request('https://attacker.example/'),/허용되지/);
 await assert.rejects(client.request('https://www.googleapis.com/oauth2/token'),/허용되지/);
});
test('Google writes are never retried after an ambiguous connection error',async()=>{
 let writes=0;const client=createGoogleClient({credentials,fetcher:async(url)=>{
  if(url.includes('/token'))return Response.json({access_token:'private',expires_in:3600});
  writes++;throw Error('connection lost');
 }});
 await assert.rejects(client.request('https://forms.googleapis.com/v1/forms',{method:'POST',body:{info:{title:'test'}}}),/connection lost/);
 assert.equal(writes,1);
});
test('Google responses follow all pages without losing earlier app/form records',async()=>{
 let pages=0;const client=createGoogleClient({credentials,fetcher:async url=>{
  if(url.includes('/token'))return Response.json({access_token:'private',expires_in:3600});
  pages++;if(pages===1)return Response.json({responses:[{responseId:'a'}],nextPageToken:'next'});
  assert.equal(new URL(url).searchParams.get('pageToken'),'next');return Response.json({responses:[{responseId:'b'}]});
 }});
 assert.deepEqual(await client.responses('form'),[{responseId:'a'},{responseId:'b'}]);assert.equal(pages,2);
});
test('expired Google access token is refreshed once; missing consent does not expose credentials',async()=>{
 let refreshes=0,requests=0;const client=createGoogleClient({credentials,fetcher:async(url)=>{
  if(url.includes('/token')){refreshes++;return Response.json({access_token:'token'+refreshes,expires_in:3600});}
  return ++requests===1?new Response('',{status:401}):Response.json({ok:true});
 }});
 assert.deepEqual(await client.form('form'),{ok:true});assert.equal(refreshes,2);
 await assert.rejects(createGoogleClient({credentials:null,fetcher:()=>assert.fail()}).form('a'),e=>e.pagesCode==='GOOGLE_NOT_CONNECTED');
});
test('Google sheet import preserves zeros, booleans, formulas, and local date values',()=>{
 const data=sheetData({sheets:[{data:[{rowData:[{values:[
  {effectiveValue:{numberValue:0},formattedValue:'0'},
  {effectiveValue:{boolValue:false},formattedValue:'FALSE'},
  {effectiveValue:{numberValue:2},userEnteredValue:{formulaValue:'=1+1'},formattedValue:'2'},
  {effectiveValue:{numberValue:25569},formattedValue:'1970-01-01',effectiveFormat:{numberFormat:{type:'DATE',pattern:'yyyy-MM-dd'}}}
 ]}]}]}]},'Asia/Seoul');
 assert.deepEqual(data.payload[0].values,[0,false,2,'1969-12-31T15:00:00.000Z']);
 assert.deepEqual(data.payload[0].dates,[3]);assert.equal(data.payload[0].formulas[2],'=1+1');
});
test('Google read planning fetches only requested tabs and prevents external writes from becoming silent successes',async()=>{
 const book='external-google-book-123',calls=[];
 const client={sheet:async(id,params)=>{
  assert.equal(id,book);calls.push(params);
  assert.equal([...params.fields].filter(c=>c==='(').length,[...params.fields].filter(c=>c===')').length);
  if(!params.ranges)return {properties:{title:'smart duty',timeZone:'Asia/Seoul'},sheets:[{properties:{sheetId:1,title:"2'중대",index:0}}]};
  assert.equal(params.ranges,"'2''중대'");return {sheets:[{data:[{rowData:[{values:[{effectiveValue:{stringValue:'정예관'},formattedValue:'정예관'}]}]}]}]};
 }};
 const options={actor:{method:'getSmart'},manifest:{settings:{},books:[]},google:createGoogleReadPlan(client),rpc:()=>assert.fail('read must not commit'),createBusiness:(a,ctx)=>({run(){try{return ctx.spreadsheet.openById(book).getSheets()[0].getRange(1,1).getValue();}catch{return 'not loaded';}}}),invoke:api=>api.run()};
 const output=await executeBusiness(options);assert.equal(output.result,'정예관');assert.equal(calls.length,2);assert.equal(output.metrics.passes,3);
 await assert.rejects(executeBusiness({...options,google:createGoogleReadPlan(client),createBusiness:(a,ctx)=>({run(){try{ctx.spreadsheet.openById(book).getSheets()[0].getRange(1,1).setValue('other');}catch{}return 'saved';}})}),e=>e.pagesCode==='NATIVE_UNSUPPORTED');
});
