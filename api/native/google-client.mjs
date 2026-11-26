// Server-only Google API transport. Credentials are provided by the secret store.
// Retry only rejected credentials; never replay a write after a network timeout.
const hosts=new Set(['sheets.googleapis.com','forms.googleapis.com','www.googleapis.com']);
export function createGoogleClient({credentials,fetcher=fetch,now=Date.now}){
 let token=null,pending=null;
 async function accessToken(){
  if(token&&token.expiresAt>now()+60000)return token.value;
  if(pending)return pending;
  pending=(async()=>{
   const c=typeof credentials==='function'?await credentials():credentials;
   if(c?.project_id!=='gunsugyedaily'||c.email!=='gunsugye@gmail.com'||!c.client_id||!c.client_secret||!c.refresh_token)throw Object.assign(Error('군수계 Google 서버 인증을 연결하세요.'),{pagesCode:'GOOGLE_NOT_CONNECTED'});
   const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:c.refresh_token,grant_type:'refresh_token'}),redirect:'error',signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok||typeof data.access_token!=='string'||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Object.assign(Error('군수계 Google 서버 인증을 갱신하지 못했습니다. 다시 연결하세요.'),{pagesCode:'GOOGLE_AUTH_REQUIRED'});
   token={value:data.access_token,expiresAt:now()+data.expires_in*1000};return token.value;
  })();
  try{return await pending;}finally{pending=null;}
 }
 async function request(url,{method='GET',body}={}){
  const target=new URL(url);
  if(target.protocol!=='https:'||target.port||target.username||target.password||!hosts.has(target.hostname)||target.hash
    ||target.hostname==='www.googleapis.com'&&!/^\/(?:upload\/)?drive\/v3\//.test(target.pathname))throw Error('허용되지 않은 Google API 주소입니다.');
  for(let attempt=0;attempt<2;attempt++){
   const value=await accessToken();
   const response=await fetcher(target.href,{method,headers:{authorization:'Bearer '+value,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)});
   if(response.status===401&&attempt===0){if(token?.value===value)token=null;continue;}
   if(!response.ok)throw Object.assign(Error(response.status===403?'Google 파일 접근 권한과 API 사용 설정을 확인하세요.':response.status===429?'Google API 요청이 많습니다. 잠시 후 다시 시도하세요.':'Google API 요청을 완료하지 못했습니다.'),{pagesCode:'GOOGLE_API_ERROR',status:response.status});
   return response.status===204?null:response.json();
  }
 }
 return {request,
  sheet: (id,params={})=>request('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'?'+new URLSearchParams(params)),
  values: (id,ranges)=>request('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values:batchGet?'+new URLSearchParams([['valueRenderOption','FORMATTED_VALUE'],...ranges.map(r=>['ranges',r])])),
  form: id=>request('https://forms.googleapis.com/v1/forms/'+encodeURIComponent(id)),
  async responses(id,filter){
   const result=[];let pageToken;const seen=new Set();
   do{
    const q=new URLSearchParams({pageSize:'5000',...(filter?{filter}:{}),...(pageToken?{pageToken}:{})});
    const page=await request('https://forms.googleapis.com/v1/forms/'+encodeURIComponent(id)+'/responses?'+q);
    result.push(...(page.responses||[]));pageToken=page.nextPageToken;
    if(pageToken&&seen.has(pageToken))throw Error('Google Forms 응답 페이지가 반복됩니다.');
    if(pageToken)seen.add(pageToken);
   }while(pageToken);
   return result;
  }
 };
}
