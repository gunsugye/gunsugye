import {build} from 'esbuild';
import {mkdir,copyFile,readdir,readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:['@supabase/supabase-js'],bundle:true,format:'esm',platform:'browser',minify:true,outfile:'rebuild/vendor/supabase.mjs'});
const output='docs/next';await mkdir(`${output}/vendor`,{recursive:true});
for(const file of (await readdir('rebuild')).filter(f=>/\.(mjs|css|html)$/.test(f)))await copyFile(`rebuild/${file}`,`${output}/${file}`);
await copyFile('rebuild/vendor/supabase.mjs',`${output}/vendor/supabase.mjs`);
console.log('새 앱 빌드: docs/next/index.html');
if(process.argv.includes('--production')){
 const target='docs/app2';await mkdir(`${target}/vendor`,{recursive:true});await mkdir('docs/me',{recursive:true});
 for(const file of (await readdir('rebuild')).filter(f=>/\.(mjs|css)$/.test(f)))await copyFile(`rebuild/${file}`,`${target}/${file}`);
 await copyFile('rebuild/vendor/supabase.mjs',`${target}/vendor/supabase.mjs`);
 const admin=(await readFile('rebuild/index.html','utf8')).replaceAll('href="./','href="./app2/').replaceAll('src="./','src="./app2/');
 const personal=(await readFile('rebuild/personal.html','utf8')).replaceAll('href="./','href="../app2/').replaceAll('src="./','src="../app2/');
 await writeFile('docs/index.html',admin);await writeFile('docs/me/index.html',personal);
 console.log('기존 주소용 빌드: docs/index.html, docs/me/index.html');
}
