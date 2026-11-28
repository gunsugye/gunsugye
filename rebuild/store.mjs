import {modules,normalizeRecord} from './modules.mjs';
export const PAGE_SIZE=50;
export class RecordStore{
 constructor(client){this.client=client;this.pending=new Set();}
 async list(kind,{mode,company='',status='',page=0}={}){
  const config=modules[kind];let query=this.client.from(config.table).select('*').eq('mode',mode);
  if(company)query=query.eq('company',Number(company));if(status)query=query.eq('status',status);
  const {data,error}=await query.order(config.order,{ascending:kind!=='journal'}).order('id').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  if(error)throw error;return {rows:data.slice(0,PAGE_SIZE),more:data.length>PAGE_SIZE};
 }
 async save(kind,values,existing,id=crypto.randomUUID()){
  const body=normalizeRecord(kind,values),key=existing?.id||id;
  if(this.pending.has(key))throw new Error('이 기록을 저장 중입니다.');this.pending.add(key);
  try{
   const table=this.client.from(modules[kind].table);
   const query=existing?table.update(body).eq('id',key).eq('version',existing.version):table.insert({...body,id:key});
   const {data,error}=await query.select().single();
   if(error){
    if(!existing&&error.code==='23505'){
     const previous=await this.client.from(modules[kind].table).select('*').eq('id',key).maybeSingle();
     if(!previous.error&&previous.data&&Object.entries(body).every(([k,v])=>previous.data[k]===v))return previous.data;
    }
    if(error.code==='PGRST116')throw new Error('다른 사용자가 수정했거나 기록이 삭제되었습니다. 목록을 다시 읽어 주세요.');throw error;
   }return data;
  }finally{this.pending.delete(key);}
 }
 async remove(kind,record){
  const {data,error}=await this.client.from(modules[kind].table).delete().eq('id',record.id).eq('version',record.version).select('id');
  if(error)throw error;if(!data.length)throw new Error('기록이 변경되었습니다. 다시 읽은 후 삭제하세요.');
 }
}
