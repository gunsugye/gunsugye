import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd(),gh=resolve('tools/github-cli/bin/gh.exe');
function api(path,body,method){const args=['api',`repos/gunsugye/gunsugye${path}`,'--method',method||(body?'POST':'GET')];if(body)args.push('--input','-');const r=spawnSync(gh,args,{cwd:root,env:{...process.env,GH_CONFIG_DIR:resolve('.deploy/github')},encoding:'utf8',input:body?JSON.stringify(body):undefined,windowsHide:true});if(r.error||r.status!==0)throw Error(r.stderr||r.error?.message);return JSON.parse(r.stdout);}
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>{if(e.isSymbolicLink())throw Error('Symlink rejected');return e.isDirectory()?files(`${path}/${e.name}`):[`${path}/${e.name}`];});}
const production=process.argv.includes('--production');
const paths=[...files('docs/next'),...files('rebuild'),'scripts/build-rebuild.mjs','scripts/publish-rebuild.mjs','scripts/dev-server.mjs',...files('tests').filter(p=>p.split('/').at(-1).startsWith('rebuild')),'docs/supabase-rebuild-status.md','package.json','package-lock.json',...(production?[...files('docs/app2'),'docs/index.html','docs/me/index.html','.github/workflows/pages.yml','workspace.ps1']:[])];
paths.push(...files('api/supabase-relay'),'scripts/check-rebuild-relay.mjs');
const head=api('/git/ref/heads/main'),parent=api(`/git/commits/${head.object.sha}`);
const tree=[];for(const path of paths){const content=readFileSync(path,'utf8');
 if(/sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(content))throw Error(`Secret-like content: ${path}`);
 for(const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{}if(claims?.role==='service_role')throw Error(`Service role key: ${path}`);}
 tree.push({path,mode:'100644',type:'blob',content});}
const next=api('/git/trees',{base_tree:parent.tree.sha,tree});
const commit=api('/git/commits',{message:production?'Switch existing app URLs to Supabase-native application':'Implement Supabase domain workflows and personal app',tree:next.sha,parents:[head.object.sha]});
api('/git/refs/heads/main',{sha:commit.sha,force:false},'PATCH');
console.log(JSON.stringify({commit:commit.sha,url:production?'https://gunsugye.github.io/gunsugye/':'https://gunsugye.github.io/gunsugye/next/',files:paths.length}));
