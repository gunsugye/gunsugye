import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
let stub=`export const client={auth:{getSession:async()=>({data:{session:{}}}),signOut:async()=>({}),signInWithOAuth:async()=>({})},from:()=>{const q={op:'select',filters:[],select(){return this},eq(k,v){this.filters.push([k,v]);return this},order(){return this},range(){return this},insert(body){this.op='insert';this.body=body;return this},update(body){this.op='update';this.body=body;return this},delete(){this.op='delete';return this},single(){return this},then(r,j){let data;const filtered=window.rows.filter(x=>this.filters.every(([k,v])=>x[k]===v));if(this.op==='select')data=filtered;else if(this.op==='insert'){data={...this.body,version:1};window.rows.push(data);}else if(this.op==='update'){Object.assign(filtered[0],this.body,{version:filtered[0].version+1});data=filtered[0];}else{window.rows=window.rows.filter(x=>!filtered.includes(x));data=filtered;}return Promise.resolve({data,error:null}).then(r,j)}};return q;}};
window.rows=[{id:'row1',mode:'semester',work_date:'2026-11-28',company:2,category:'일반',title:'시험 업무',details:'',status:'진행 중',version:1}];
export async function currentMember(){return new URLSearchParams(location.search).has('company')?{email:'company@example.invalid',role:'company',company:2}:{email:'admin@example.invalid',role:'admin'};}`;
const domain=process.argv.includes('--domain');if(domain)stub=(await import('./rebuild-domain-stub.mjs')).stub;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;let data;if(path==='/client.mjs')data=stub;else data=await readFile(resolve('rebuild','.'+(path==='/'?'/index.html':path)));res.setHeader('content-type',({'.mjs':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'text/html');res.end(data);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port,base=`http://127.0.0.1:${port}`;
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${resolve('.deploy/rebuild-browser-'+Date.now())}`],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let stderr='',ws,send;browser.stderr.on('data',b=>stderr+=b);
try{
 for(let i=0;i<100&&!stderr.includes('DevTools listening on');i++)await new Promise(r=>setTimeout(r,100));
 const endpoint=stderr.match(/DevTools listening on (ws:\S+)/)?.[1];assert.ok(endpoint,'Chrome started');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let seq=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
 send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 for(const width of [1280,390]){
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600},sessionId);
  await send('Page.navigate',{url:base},sessionId);
  if(domain){
   for(let i=0;i<80;i++){if(await evaluate("document.querySelector('.notice')?.textContent.includes('admin@example.invalid')"))break;await new Promise(r=>setTimeout(r,100));}
   const pages=await evaluate("Array.from(document.querySelectorAll('[data-page]')).map(x=>x.dataset.page)");
   for(const page of pages){await evaluate(`document.querySelector('[data-page="${page}"]').click()`);await new Promise(r=>setTimeout(r,80));assert.equal(await evaluate("document.querySelector('#content').textContent.includes('전환 중')"),false,page);assert.equal(await evaluate("document.querySelectorAll('#content .error').length"),0,page);}
   await evaluate("document.querySelector('[data-mode=training]').click()");await new Promise(r=>setTimeout(r,80));
   const trainingPages=await evaluate("Array.from(document.querySelectorAll('[data-page]')).map(x=>x.dataset.page)");
   for(const page of trainingPages){await evaluate(`document.querySelector('[data-page="${page}"]').click()`);await new Promise(r=>setTimeout(r,80));assert.equal(await evaluate("document.querySelectorAll('#content .error').length"),0,'훈련 '+page);}
   await send('Page.navigate',{url:base+'/personal.html'},sessionId);
   for(let i=0;i<80;i++){if(await evaluate("document.querySelectorAll('#cards details').length>0"))break;await new Promise(r=>setTimeout(r,100));}
   assert.equal(await evaluate("window.calls.filter(t=>t==='app2_inventory').length"),1,'only open section loaded');
   await evaluate("Array.from(document.querySelectorAll('#cards details')).find(d=>d.querySelector('summary').textContent==='군수품').open=true");await new Promise(r=>setTimeout(r,150));
   await evaluate("Array.from(document.querySelectorAll('.item-link')).find(b=>b.textContent==='모포').click()");
   await evaluate("document.querySelector('dialog select').value='1';document.querySelector('dialog select[name=status]').value='정상';document.querySelector('dialog form').requestSubmit()");
   assert.equal(await evaluate("window.submissions.length"),0,'popup only stages edits');
   await evaluate("document.querySelector('.bulk-save').click()");await new Promise(r=>setTimeout(r,80));
   assert.equal(await evaluate("document.querySelector('dialog').textContent.includes('모포')"),true);
   await evaluate("Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent==='확인 후 제출').click()");await new Promise(r=>setTimeout(r,100));
   assert.equal(await evaluate("window.submissions[0].args.p_items.length"),1);
   assert.equal(await evaluate("window.submissions[0].args.p_items[0].catalog_id"),'blanket');
   assert.deepEqual(await evaluate('window.errors'),[]);
   console.log(width+'px: 전체 메뉴, 접힌 항목 지연 조회, 개인 팝업·변경분 일괄 제출 통과');await send('Target.closeTarget',{targetId});continue;
  }
  for(let i=0;i<80;i++){if(await evaluate("!!document.querySelector('tbody')"))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate("document.querySelectorAll('tbody tr').length"),1);
  await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='추가').click()");
  assert.equal(await evaluate("!!document.querySelector('dialog[open]')"),true);
  await evaluate("document.querySelector('[name=title]').value='새 업무';document.querySelector('[name=company]').value='2';document.querySelector('form').requestSubmit()");
  assert.equal(await evaluate("window.rows.length"),2);
  await evaluate("document.querySelector('tbody button').click()");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.dialog-actions button')).map(b=>b.textContent).join(',')"),'삭제,취소,저장');
  await evaluate("document.querySelector('[name=title]').value='수정한 업무';document.querySelector('form').requestSubmit()");
  assert.equal(await evaluate("window.rows[0].title"),'수정한 업무');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'no body overflow');
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(`.deploy/rebuild-${width}.png`,Buffer.from(shot.data,'base64'));
  await send('Page.navigate',{url:base+'/?company=2'},sessionId);
  for(let i=0;i<80;i++){if(await evaluate("!!document.querySelector('tbody')"))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='추가')"),false);
  assert.equal(await evaluate("document.querySelector('[data-mode=training]').disabled"),true);
  await evaluate("document.querySelector('tbody button').click()");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.dialog-actions button')).map(b=>b.textContent).join(',')"),'확인');
  assert.equal(await evaluate("document.querySelector('[name=title]').disabled"),true);
  console.log(`${width}px: 조회, 추가, 수정, 버튼 순서, 중대 열람 제한 통과`);await send('Target.closeTarget',{targetId});
 }
}finally{if(send)await Promise.race([send('Browser.close').catch(()=>{}),new Promise(r=>setTimeout(r,1500))]);ws?.close();server.close();browser.kill();}
