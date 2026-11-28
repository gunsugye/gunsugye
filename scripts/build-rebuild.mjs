import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await build({entryPoints:['@supabase/supabase-js'],bundle:true,format:'esm',platform:'browser',minify:true,outfile:'rebuild/vendor/supabase.mjs'});
const output='docs/next';await mkdir(`${output}/vendor`,{recursive:true});
for(const file of ['index.html','main.mjs','model.mjs','modules.mjs','store.mjs','client.mjs','config.mjs','style.css','forms.css','vendor/supabase.mjs'])await copyFile(`rebuild/${file}`,`${output}/${file}`);
console.log('새 앱 빌드: docs/next/index.html');
