const site='https://gunsugye.pages.dev',relay='https://logbook-supabase.gunsugye.workers.dev';
for(const path of ['/','/me/','/app2/config.mjs','/app2/main.mjs','/app2/google-login.mjs']){
 const r=await fetch(site+path,{signal:AbortSignal.timeout(15000)}),body=await r.text();
 const valid=r.ok&&(path.endsWith('.mjs')?/javascript/.test(r.headers.get('content-type')):/app2\//.test(body));
 console.log(JSON.stringify({path,status:r.status,valid}));if(!valid)process.exitCode=1;
}
for(const path of ['/login-config','/rest/v1/app2_people']){
 const r=await fetch(relay+path,{method:path==='/login-config'?'GET':'OPTIONS',headers:{origin:site,'access-control-request-method':'POST','access-control-request-headers':'authorization,apikey,content-type'},signal:AbortSignal.timeout(15000)});
 console.log(JSON.stringify({path,status:r.status,cors:r.headers.get('access-control-allow-origin')===site}));if(!r.ok||r.headers.get('access-control-allow-origin')!==site)process.exitCode=1;
}
