import './build-rebuild.mjs';
import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
const target='.deploy/cloudflare-site';
await mkdir(target+'/app2/vendor',{recursive:true});await mkdir(target+'/me',{recursive:true});
// Explicit source allowlist: never upload .deploy itself, database exports, or credentials.
for(const file of (await readdir('rebuild')).filter(f=>/\.(mjs|css)$/.test(f)))await copyFile('rebuild/'+file,target+'/app2/'+file);
await copyFile('rebuild/vendor/supabase.mjs',target+'/app2/vendor/supabase.mjs');
for(const [source,dest,prefix] of [['index.html','index.html','./app2/'],['personal.html','me/index.html','../app2/']]){
 const html=(await readFile('rebuild/'+source,'utf8')).replaceAll('href="./','href="'+prefix).replaceAll('src="./','src="'+prefix);
 await writeFile(target+'/'+dest,html);
}
await writeFile(target+'/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-cache\n/app2/*.mjs\n  Content-Type: text/javascript; charset=utf-8\n');
await writeFile(target+'/404.html','<!doctype html><html lang="ko"><meta charset="utf-8"><title>페이지 없음</title><p>페이지를 찾지 못했습니다. <a href="/">군수계 앱으로 이동</a></p></html>');
console.log('Cloudflare 전용 정적 빌드: '+target);
