// Use the REST artifact ID directly when the Actions artifact service lists zero files.
// Pages API contract: https://github.com/actions/deploy-pages/blob/v4/src/internal/api-client.js
import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export async function deployPages(env, {fetcher=fetch, sleep=ms=>new Promise(r=>setTimeout(r,ms)), log=console.log, output=(key,value)=>appendFileSync(env.GITHUB_OUTPUT,`${key}=${value}\n`)}={}) {
 if(env.GITHUB_REPOSITORY!=='gunsugye/gunsugye'||!/^\d+$/.test(env.GITHUB_RUN_ID||'')||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')||!env.GITHUB_TOKEN||!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||!env.ACTIONS_ID_TOKEN_REQUEST_URL?.startsWith('https://'))throw Error('Pages deployment environment is incomplete');
 const root='https://api.github.com/repos/'+env.GITHUB_REPOSITORY;
 async function json(url,options={}) {
  let response;try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(30000)});}catch(_){throw Error('Pages network request failed');}
  if(!response.ok)throw Error('Pages API returned HTTP '+response.status);
  return response.status===204?{}:response.json();
 }
 const api=(path,body)=>json(root+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json','content-type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let artifact;
 for(let attempt=0;attempt<18;attempt++) {
  const data=await api('/actions/runs/'+env.GITHUB_RUN_ID+'/artifacts?per_page=100');
  const matches=(data.artifacts||[]).filter(a=>a.name==='github-pages'&&!a.expired);
  if(matches.length>1)throw Error('Multiple Pages artifacts for this run');
  if(matches.length===1){artifact=matches[0];break;}
  await sleep(5000);
 }
 if(!artifact||!Number.isSafeInteger(artifact.id)||artifact.id<=0)throw Error('Pages artifact is not ready');
 const identity=await json(env.ACTIONS_ID_TOKEN_REQUEST_URL,{headers:{authorization:'Bearer '+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});
 if(typeof identity.value!=='string'||!identity.value)throw Error('Pages identity token is missing');
 const deployment=await api('/pages/deployments',{artifact_id:artifact.id,pages_build_version:env.GITHUB_SHA,oidc_token:identity.value});
 const id=String(deployment.id||deployment.status_url?.split('/').pop()||'');
 if(!/^[\w-]+$/.test(id))throw Error('Pages deployment ID is missing');
 const path='/pages/deployments/'+encodeURIComponent(id);
 log('Pages deployment created for artifact '+artifact.id);
 for(let attempt=0;attempt<60;attempt++) {
  await sleep(10000);
  const current=await api(path);
  if(current.status==='succeed') {
   const url=deployment.page_url||'https://gunsugye.github.io/gunsugye/';
   if(/[\r\n]/.test(url))throw Error('Invalid Pages URL');
   output('page_url',url);log('Pages deployment succeeded');return {id,artifactId:artifact.id,url};
  }
  if(['deployment_failed','deployment_perms_error','deployment_content_failed','deployment_cancelled','deployment_lost'].includes(current.status))throw Error('Pages deployment failed: '+current.status);
  log('Pages deployment: '+String(current.status||'pending'));
 }
 await api(path+'/cancel',{});
 throw Error('Pages deployment timed out');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)deployPages(process.env).catch(error=>{console.error(error.message);process.exitCode=1;});
