import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {readdirSync,readFileSync} from 'node:fs';
const target=resolve('.deploy/cloudflare-site');
function check(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Symlink rejected');const path=resolve(dir,e.name);if(e.isDirectory()){check(path);continue;}if(!/\.(html|css|mjs)$/.test(e.name)&&e.name!=='_headers')throw Error('Unexpected public file: '+e.name);const content=readFileSync(path,'utf8');if(/sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(content))throw Error('Private key in public output');for(const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{}if(claims?.role==='service_role')throw Error('Privileged key in public output');}}}
check(target);
const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','pages','deploy',target,'--project-name','gunsugye','--branch','main','--commit-dirty=true'],{stdio:'inherit',windowsHide:true,env:{...process.env,XDG_CONFIG_HOME:resolve('.deploy/cloudflare'),WRANGLER_LOG_PATH:resolve('.deploy/logs'),WRANGLER_SEND_METRICS:'false'}});
if(result.error)throw result.error;process.exitCode=result.status??1;
