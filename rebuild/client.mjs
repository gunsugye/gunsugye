import {createClient} from './vendor/supabase.mjs';
import {config} from './config.mjs';
export const client=createClient(config.url,config.key,{global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)})},auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'gunsugye-app2-auth'}});
export async function currentMember(){
 const {data:{session},error}=await client.auth.getSession();if(error)throw error;if(!session)return null;
 const {data,error:readError}=await client.from('app2_members').select('email,role,company').maybeSingle();
 if(readError)throw readError;if(!data)throw new Error('이 계정에 새 앱 접근 권한이 없습니다. 관리자에게 계정 등록을 요청하세요.');return data;
}
