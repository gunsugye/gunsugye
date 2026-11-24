// Deployed privately with the digest of a server-only 256-bit credential.
// Browser credentials never have direct access to workbook tables or these RPCs.
const credentialDigest = '__SERVER_CREDENTIAL_SHA256__';
const dataset = '__DATASET_UUID__';
const endpoint = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
async function rpc(name: string, args: unknown) {
 const response = await fetch(endpoint + '/rest/v1/rpc/' + name, {method:'POST',headers:{apikey:serviceKey,authorization:'Bearer '+serviceKey,'content-type':'application/json'},body:JSON.stringify(args)});
 const result = await response.json();
 if (!response.ok) { const error = new Error(result.code === '40001' ? '다른 변경이 먼저 저장되었습니다. 다시 불러온 뒤 저장하세요.' : '데이터베이스 처리를 완료하지 못했습니다.'); Object.assign(error,{dbCode:result.code}); throw error; }
 return result;
}
Deno.serve(async request => {
 try {
  if(request.method!=='POST')return json({ok:false},405);
  const credential=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!/^[a-f0-9]{64}$/.test(credential))return json({ok:false},401);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(credential)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  let difference=hash.length^credentialDigest.length;for(let i=0;i<hash.length;i++)difference|=hash.charCodeAt(i)^credentialDigest.charCodeAt(i);
  if(difference)return json({ok:false},401);
  const input=await request.json();let result;
  if(input.action==='manifest')result=await rpc('logbook_manifest',{p_dataset:dataset});
  else if(input.action==='read'&&Array.isArray(input.sheets)&&input.sheets.length<=80)result=await rpc('logbook_read_sheets',{p_dataset:dataset,p_sheets:input.sheets});
  else if(input.action==='attachment')result=await rpc('logbook_attachment',{p_dataset:dataset,p_id:input.id});
  else if(input.action==='commit'&&/^[0-9a-f-]{36}$/.test(input.request||'')&&typeof input.actor==='string'&&typeof input.method==='string')result=await rpc('logbook_transaction',{p_dataset:dataset,p_request:input.request,p_actor:input.actor,p_method:input.method,p_payload:input.payload});
  else return json({ok:false,error:'Invalid storage action'},400);
  if(input.action==='read'||input.action==='attachment'){
   const stream=new Blob([JSON.stringify(result)]).stream().pipeThrough(new CompressionStream('gzip'));
   const bytes=new Uint8Array(await new Response(stream).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return json({ok:true,compressed:btoa(binary)});
  }
  return json({ok:true,result});
 }catch(error){return json({ok:false,error:error instanceof Error?error.message:'Storage error',code:(error as {dbCode?:string}).dbCode||'STORAGE_ERROR'},503);}
});
