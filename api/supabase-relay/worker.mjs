// Fixed upstream only. No administrator credentials, response caching, or token logs.
const upstream='https://ylwzhooidqgvecocnzai.supabase.co';
const origin='https://gunsugye.github.io';
const key='sb_publishable_Te14sqwj_ipaaEPWMIchcg_gCuEdwTf';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,HEAD,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,prefer,range,range-unit,accept-profile,content-profile,x-supabase-api-version','Access-Control-Expose-Headers':'content-range,range-unit,preference-applied','Access-Control-Max-Age':'3600','Vary':'Origin','Cache-Control':'no-store'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
export async function handle(request,fetcher=fetch){
 const url=new URL(request.url),path=url.pathname;
 if(request.headers.get('origin')&&request.headers.get('origin')!==origin)return json({message:'Origin not allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 try{
  if(path==='/login-config'&&request.method==='GET'){
   const r=await fetcher(upstream+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent(origin+'/gunsugye/'),{redirect:'manual',headers:{apikey:key},signal:AbortSignal.timeout(12000)});
   const location=r.headers.get('location');if(!location)return json({message:'Google 제공자 설정을 확인하세요.'},502);
   const target=new URL(location);if(target.origin!=='https://accounts.google.com')return json({message:'Google 인증 주소 확인 실패'},502);
   const clientId=target.searchParams.get('client_id');if(!clientId?.endsWith('.apps.googleusercontent.com'))return json({message:'Google Client ID 확인 실패'},502);
   return json({clientId});
  }
  const auth=path==='/auth/v1/token'&&request.method==='POST'&&['id_token','refresh_token','pkce'].includes(url.searchParams.get('grant_type'))||path==='/auth/v1/user'&&request.method==='GET'||path==='/auth/v1/logout'&&request.method==='POST';
  const rest=/^\/rest\/v1\/(?:app2_[a-z_]+|rpc\/app2_(?:submit|review|transfer_training))$/.test(path)&&['GET','HEAD','POST','PATCH','DELETE'].includes(request.method);
  if(!auth&&!rest)return json({message:'Route not allowed'},404);
  if(rest&&!/^Bearer .+/i.test(request.headers.get('authorization')||''))return json({message:'로그인이 필요합니다.'},401);
  if(Number(request.headers.get('content-length')||0)>1048576)return json({message:'요청이 너무 큽니다.'},413);
  let body;if(!['GET','HEAD'].includes(request.method)&&request.body){const reader=request.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();return json({message:'요청이 너무 큽니다.'},413);}chunks.push(value);}body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}}
  const headers=new Headers({apikey:key});
  for(const h of ['authorization','content-type','x-client-info','prefer','range','range-unit','accept-profile','content-profile','x-supabase-api-version'])if(request.headers.has(h))headers.set(h,request.headers.get(h));
  const response=await fetcher(upstream+path+url.search,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(response.status>=300&&response.status<400)return json({message:'예상하지 않은 서버 이동입니다.'},502);
  const out=new Headers(cors);for(const h of ['content-type','content-range','range-unit','preference-applied','retry-after'])if(response.headers.has(h))out.set(h,response.headers.get(h));
  return new Response(response.body,{status:response.status,headers:out});
 }catch{return json({message:'연결 서버에서 Supabase 응답을 확인하지 못했습니다. 잠시 후 다시 시도하세요.'},504);}
}
export default {fetch:request=>handle(request)};
