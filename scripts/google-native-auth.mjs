// One-time owner consent. Credentials and refresh tokens stay under ignored .deploy/.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const redirectUri='http://127.0.0.1:53684/oauth/callback';
export const scopes=['openid','email',
 'https://www.googleapis.com/auth/spreadsheets',
 'https://www.googleapis.com/auth/drive.readonly',
 'https://www.googleapis.com/auth/drive.file',
 'https://www.googleapis.com/auth/forms.body',
 'https://www.googleapis.com/auth/forms.responses.readonly'];

export function validateClient(document){
 const client=document.web;
 if(!client||client.project_id!=='gunsugyedaily'||!String(client.client_id||'').endsWith('.apps.googleusercontent.com')||!client.client_secret||!client.redirect_uris?.includes(redirectUri))throw Error('gunsugyedaily의 웹 클라이언트와 승인된 리디렉션 URI를 확인하세요.');
 return client;
}
export function validateState(url,state){
 const actual=Buffer.from(url.searchParams.get('state')||''),expected=Buffer.from(state);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function validateGrant(profile,granted,tokens){
 if(profile?.email!=='gunsugye@gmail.com'||profile.email_verified!==true)throw Error('군수계(gunsugye@gmail.com) 계정으로 인증해야 합니다.');
 const normalized=new Set(granted.map(s=>s==='https://www.googleapis.com/auth/userinfo.email'?'email':s));
 if(scopes.some(s=>!normalized.has(s)))throw Error('Sheets·Drive·Forms 권한을 모두 승인해야 합니다.');
 if(!tokens.refresh_token)throw Error('서버 인증 갱신 토큰이 없습니다. 동의 화면에서 다시 연결하세요.');
}

export async function authorize(){
 const {OAuth2Client,CodeChallengeMethod}=await import('google-auth-library');
 const client=validateClient(JSON.parse(readFileSync('.deploy/google-native-client.json','utf8').replace(/^\uFEFF/,'')));
 const auth=new OAuth2Client(client.client_id,client.client_secret,redirectUri);
 const {codeVerifier,codeChallenge}=await auth.generateCodeVerifierAsync(),state=randomBytes(32).toString('base64url');
 const authUrl=auth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:scopes,state,login_hint:'gunsugye@gmail.com',code_challenge:codeChallenge,code_challenge_method:CodeChallengeMethod.S256});
 let processing=false;
 await new Promise((done,fail)=>{
  const timer=setTimeout(()=>{server.close();fail(Error('인증 대기 시간이 지났습니다. 다시 실행하세요.'));},10*60*1000);
  const server=createServer(async(request,response)=>{
   response.setHeader('Content-Type','text/plain; charset=utf-8');response.setHeader('Cache-Control','no-store');response.setHeader('Referrer-Policy','no-referrer');
   const url=new URL(request.url||'/','http://127.0.0.1:53684');
   if(request.method!=='GET'||url.pathname!=='/oauth/callback'){response.writeHead(404).end();return;}
   if(!validateState(url,state)){response.writeHead(400).end('인증 요청이 일치하지 않습니다.');return;}
   if(processing){response.writeHead(409).end('인증을 처리 중입니다.');return;}
   processing=true;
   try{
    if(url.searchParams.has('error')||!url.searchParams.get('code'))throw Error('Google 계정 연결이 승인되지 않았습니다.');
    const {tokens}=await auth.getToken({code:url.searchParams.get('code'),codeVerifier});
    if(!tokens.id_token||!tokens.access_token)throw Error('인증 응답을 확인하지 못했습니다.');
    const ticket=await auth.verifyIdToken({idToken:tokens.id_token,audience:client.client_id});
    const info=await auth.getTokenInfo(tokens.access_token);
    validateGrant(ticket.getPayload(),info.scopes,tokens);
    mkdirSync('.deploy',{recursive:true});
    // Never emit tokens, authorization codes, or client secrets to output.
    writeFileSync('.deploy/google-native-credentials.json',JSON.stringify({project_id:client.project_id,email:'gunsugye@gmail.com',client_id:client.client_id,client_secret:client.client_secret,refresh_token:tokens.refresh_token,scopes:info.scopes,connectedAt:new Date().toISOString()},null,2),{mode:0o600});
    response.end('군수계 서버 연결 인증이 완료되었습니다. 창을 닫아도 됩니다.');
    console.log('군수계 인증 저장 완료: .deploy/google-native-credentials.json');done();
   }catch(error){response.writeHead(400).end('인증을 완료하지 못했습니다. 작업 화면으로 돌아가 주세요.');fail(Error(error.response?'Google 인증 요청이 거절되었습니다. 클라이언트·권한 설정을 확인하세요.':error.message));}
   finally{clearTimeout(timer);server.close();}
  });
  server.once('error',error=>{clearTimeout(timer);fail(error);});
  server.listen(53684,'127.0.0.1',()=>console.log('군수계 계정으로 다음 주소를 열어 승인하세요:\n'+authUrl));
 });
}
async function checkNetwork(){
 const {OAuth2Client}=await import('google-auth-library');
 const auth=new OAuth2Client();
 try{await auth.transporter.request({url:'https://oauth2.googleapis.com/token',method:'POST',data:{grant_type:'authorization_code'},timeout:10000,retry:false});}
 catch(error){if(error.response?.status===400){console.log('Google 인증 서버 연결 확인 완료');return;}throw Error('Google 인증 서버 연결 실패: '+(error.code||error.cause?.code||'NETWORK_ERROR'));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)(process.argv.includes('--check-network')?checkNetwork():authorize()).catch(error=>{console.error(error.message);process.exitCode=1;});
