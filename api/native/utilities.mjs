import {createHash,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Buffer} from 'node:buffer';

export function nativeUtilities(ids=[],clock=Date.now()){
 let cursor=0;
 const bytes=v=>typeof v==='string'?Buffer.from(v,'utf8'):Buffer.from(v);
 function blob(value,type='application/octet-stream',name=''){
  const b=bytes(value);
  return {getBytes:()=>[...b].map(v=>v>127?v-256:v),getDataAsString:(encoding='UTF-8')=>b.toString(encoding.toLowerCase().replace('-','')),getContentType:()=>type,getName:()=>name,setContentType(v){type=v;return this;},setName(v){name=v;return this;}};
 }
 return {getUuid:()=>ids[cursor++]??(ids[cursor-1]=randomUUID()),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
  computeDigest:(algorithm,value)=>[...createHash(algorithm).update(bytes(value)).digest()].map(v=>v>127?v-256:v),
  base64Encode:v=>bytes(v).toString('base64'),base64EncodeWebSafe:v=>bytes(v).toString('base64').replaceAll('+','-').replaceAll('/','_'),base64Decode:v=>[...Buffer.from(v,'base64')].map(v=>v>127?v-256:v),
  newBlob:blob,gzip:b=>blob(gzipSync(bytes(b.getBytes())),'application/gzip'),ungzip:b=>blob(gunzipSync(bytes(b.getBytes()))),
  formatDate(date,timeZone,format){if(!format||format==='General'||format==='@')format='yyyy-MM-dd HH:mm:ss';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timeZone||'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return format.replace(/yyyy|MM|dd|HH|hh|mm|ss/g,s=>parts[({yyyy:'year',MM:'month',dd:'day',HH:'hour',hh:'hour',mm:'minute',ss:'second'})[s]]);},
  sleep(){throw Error('Blocking sleep is not supported by the independent runtime');}
 };
}

export function requestDate(now){return class extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};}
