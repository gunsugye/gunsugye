import test from 'node:test';
import assert from 'node:assert/strict';
import {deployPages} from '../scripts/pages-deploy.mjs';
const env={GITHUB_REPOSITORY:'gunsugye/gunsugye',GITHUB_RUN_ID:'123',GITHUB_SHA:'a'.repeat(40),GITHUB_TOKEN:'test-api-token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'test-request-token',ACTIONS_ID_TOKEN_REQUEST_URL:'https://identity.example/token'};
function setup({duplicate=false,failed=false,missing=false}={}) {
 const calls=[],logs=[],outputs=[];let lists=0;
 const options={sleep:async()=>{},log:s=>logs.push(s),output:(...args)=>outputs.push(args),fetcher:async(url,options)=>{
  calls.push({url,...options});let result;
  if(url.includes('/artifacts?')){lists++;result={artifacts:missing?[]:lists===1?[]:[{id:7,name:'github-pages',expired:false},...(duplicate?[{id:8,name:'github-pages',expired:false}]:[])]};}
  else if(url===env.ACTIONS_ID_TOKEN_REQUEST_URL)result={value:'test-identity-token'};
  else if(options.method==='POST')result={id:'deployment-id',page_url:'https://gunsugye.github.io/gunsugye/'};
  else result={status:failed?'deployment_content_failed':'succeed'};
  return {ok:true,status:200,json:async()=>result};
 }};return {calls,logs,outputs,options};
}
test('Pages uses the current run REST artifact ID and succeeds without logging credentials',async()=>{
 const f=setup(),result=await deployPages(env,f.options);assert.equal(result.artifactId,7);
 const post=f.calls.find(c=>c.url.endsWith('/pages/deployments'));assert.equal(JSON.parse(post.body).artifact_id,7);assert.equal(JSON.parse(post.body).oidc_token,'test-identity-token');
 assert.equal(f.outputs[0][0],'page_url');assert.ok(f.calls[0].url.includes('/runs/123/'));assert.ok(!f.logs.join('').includes('token'));
});
test('Pages rejects ambiguous artifacts before issuing identity or deployment requests',async()=>{
 const f=setup({duplicate:true});await assert.rejects(deployPages(env,f.options),/Multiple/);assert.ok(f.calls.every(c=>c.url.includes('/artifacts?')));
});
test('Pages reports terminal deployment failure instead of publishing a success output',async()=>{
 const f=setup({failed:true});await assert.rejects(deployPages(env,f.options),/deployment_content_failed/);assert.equal(f.outputs.length,0);
});
test('Pages stops when the uploaded artifact never becomes available',async()=>{
 const f=setup({missing:true});await assert.rejects(deployPages(env,f.options),/not ready/);assert.equal(f.calls.length,18);
});
