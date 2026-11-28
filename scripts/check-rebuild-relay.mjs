const base='https://logbook-supabase.gunsugye.workers.dev';
for(const [path,options,expected] of [
 ['/login-config',{},200],
 ['/rest/v1/app2_people?select=id',{},401],
 ['/rest/v1/app2_people?select=id',{headers:{authorization:'Bearer invalid-test-token'}},401],
 ['/auth/v1/admin/users',{},404],
 ['/rest/v1/app2_people',{method:'OPTIONS',headers:{origin:'https://gunsugye.github.io','access-control-request-method':'POST','access-control-request-headers':'authorization,content-type,apikey'}},204]
]){const start=performance.now(),r=await fetch(base+path,{...options,signal:AbortSignal.timeout(25000)});await r.text();console.log(JSON.stringify({path,status:r.status,ms:Math.round(performance.now()-start),noStore:r.headers.get('cache-control')==='no-store'}));if(r.status!==expected)process.exitCode=1;}
