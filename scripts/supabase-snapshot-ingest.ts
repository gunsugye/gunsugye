// Temporary migration endpoint. A SHA-256 token hash and expiry are injected at deploy time.
const TOKEN_HASH = '__TOKEN_HASH__';
const EXPIRES = __EXPIRES__;
const PROJECT = 'ylwzhooidqgvecocnzai';
async function hash(value: string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async(req: Request)=>{
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST'||Date.now()>EXPIRES||await hash(req.headers.get('x-migration-token')||'')!==TOKEN_HASH)return reply(403,{ok:false});
 try{
 const text=await req.text();if(text.length>8*1024*1024)return reply(413,{ok:false});const input=JSON.parse(text);
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!key)throw Error('Server key unavailable');
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'};
 let table,body;
 if(input.action==='verify'){
  if(!/^[0-9a-f-]{36}$/.test(input.id))throw Error('Invalid run');
  let path='logbook_import_runs?id=eq.'+encodeURIComponent(input.id)+'&select=manifest';
  if(input.chunk){const c=input.chunk;if(!Number.isSafeInteger(c.sheet_id)||!Number.isSafeInteger(c.start_row)||typeof c.book_id!=='string')throw Error('Invalid range');path='logbook_import_chunks?run_id=eq.'+encodeURIComponent(input.id)+'&book_id=eq.'+encodeURIComponent(c.book_id)+'&sheet_id=eq.'+c.sheet_id+'&start_row=eq.'+c.start_row+'&select=*';}
  const res=await fetch('https://'+PROJECT+'.supabase.co/rest/v1/'+path,{headers});if(!res.ok)throw Error('Verification read failed: '+res.status);
  return reply(200,{ok:true,records:await res.json()});
 }
 if(input.action==='manifest'){
  if(!/^[0-9a-f-]{36}$/.test(input.id)||!Array.isArray(input.manifest?.books))throw Error('Invalid manifest');
  table='logbook_import_runs';body={id:input.id,manifest:input.manifest,status:'copying'};
 }else if(input.action==='chunk'){
  const c=input.chunk;if(!c||!Array.isArray(c.payload)||c.row_count!==c.payload.length||c.row_count<1||c.row_count>200||c.checksum!==await hash(JSON.stringify(c.payload)))throw Error('Invalid chunk checksum');
  table='logbook_import_chunks';body=c;
 }else throw Error('Invalid action');
 const res=await fetch('https://'+PROJECT+'.supabase.co/rest/v1/'+table,{method:'POST',headers,body:JSON.stringify(body)});
 if(!res.ok)throw Error('Database write failed: '+res.status);
 return reply(200,{ok:true});
 }catch(e){return reply(400,{ok:false,error:String(e.message).slice(0,200)});}
});
