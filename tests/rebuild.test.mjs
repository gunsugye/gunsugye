import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecord} from '../rebuild/modules.mjs';
import {RecordStore} from '../rebuild/store.mjs';
const values={mode:'semester',work_date:'2026-11-28',company:'2',category:'일반',title:'점검',status:'진행 중',details:''};
test('record normalization preserves optional blank details and numeric company',()=>{assert.equal(normalizeRecord('journal',values).company,2);assert.equal(normalizeRecord('journal',values).details,'');assert.throws(()=>normalizeRecord('journal',{...values,title:''}));assert.throws(()=>normalizeRecord('journal',{...values,company:'9'}));});
function fake(response){const calls=[];const q={};for(const method of ['select','eq','order','range','update','insert','delete'])q[method]=(...args)=>{calls.push([method,...args]);return q;};q.single=()=>Promise.resolve(response);q.then=(resolve,reject)=>Promise.resolve(response).then(resolve,reject);return {client:{from:()=>q},calls};}
test('update compares record version and reports concurrent changes',async()=>{const f=fake({error:{code:'PGRST116'}});await assert.rejects(new RecordStore(f.client).save('journal',values,{id:'a',version:4}),/다른 사용자/);assert.ok(f.calls.some(x=>x[0]==='eq'&&x[1]==='version'&&x[2]===4));});
test('delete cannot silently succeed on stale version',async()=>{const f=fake({data:[]});await assert.rejects(new RecordStore(f.client).remove('journal',{id:'a',version:1}),/변경/);});
test('list is bounded and reads one extra row to detect next page',async()=>{const f=fake({data:Array.from({length:51},(_,id)=>({id}))});const r=await new RecordStore(f.client).list('journal',{mode:'semester',page:2,company:2});assert.equal(r.rows.length,50);assert.equal(r.more,true);assert.deepEqual(f.calls.find(x=>x[0]==='range'),['range',100,150]);});
test('failed save releases only its record lock',async()=>{const f=fake({error:{message:'offline'}});const store=new RecordStore(f.client);await assert.rejects(store.save('journal',values,null,'x'));assert.equal(store.pending.size,0);});
