import {client} from './client.mjs';
export async function result(query){const {data,error}=await query;if(error)throw error;return data;}
export async function rows(table,{filters={},order='id',columns='*',limit=1000,offset=0}={}){let q=client.from(table).select(columns);for(const [key,value] of Object.entries(filters)){if(value===undefined||value==='')continue;q=Array.isArray(value)?q.in(key,value):value===null?q.is(key,null):q.eq(key,value);}return result(q.order(order).range(offset,offset+limit-1));}
export async function allRows(table,options={}){const out=[];for(let offset=0;;offset+=1000){const batch=await rows(table,{...options,limit:1000,offset});out.push(...batch);if(batch.length<1000)return out;if(out.length>=100000)throw Error('조회 범위를 좁혀 주세요.');}}
export async function write(table,body,record,id=crypto.randomUUID()) {let q=client.from(table);q=record?q.update(body).eq('id',record.id).eq('version',record.version):q.insert({...body,id});try{return await result(q.select().single());}catch(e){if(e.code==='PGRST116')throw Error('다른 사용자가 수정했습니다. 다시 읽어 주세요.');throw e;}}
export async function remove(table,record){const r=await result(client.from(table).delete().eq('id',record.id).eq('version',record.version).select('id'));if(!r.length)throw Error('기록이 변경되었습니다. 다시 읽어 주세요.');}
export const rpc=(name,args)=>result(client.rpc(name,args));
let catalogPromise;
export function catalog(refresh=false){if(refresh)catalogPromise=null;return catalogPromise??=(rows('app2_catalog',{order:'position'}).catch(e=>{catalogPromise=null;throw e;}));}
export async function setting(id,fallback){const data=await result(client.from('app2_settings').select('*').eq('id',id).maybeSingle());return data||{id,value:fallback};}
export async function saveSetting(record,value){if(record.version)return write('app2_settings',{value},record);return result(client.from('app2_settings').insert({id:record.id,value}).select().single());}
export async function people(mode,filters={}){return allRows('app2_people',{filters:{mode,...filters},order:'name'});}
export function personLabel(p){return `${p.cohort}기 ${p.company}중대 ${p.name}${p.cadet_number?' · '+p.cadet_number:''}`;}
