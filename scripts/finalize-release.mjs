import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { releaseDetails } from './release.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function finalizeRelease(){
 const read=path=>readFileSync(resolve(root,path),'utf8').replace(/\r\n/g,'\n'),write=(path,text)=>writeFileSync(resolve(root,path),text),hash=text=>createHash('sha256').update(text).digest('hex').slice(0,16);
 const previous=existsSync(resolve(root,'docs/releases.json'))?JSON.parse(read('docs/releases.json')):[];
 const archive=[releaseDetails,...previous.filter(row=>row.version!==releaseDetails.version)];
 write('docs/releases.json',JSON.stringify(archive,null,2)+'\n');
 const js=read('docs/assets/app.js'),paths=['assets/app.css','assets/pages.css','assets/pages.js','assets/updates.js','assets/navigation-start.js','config.js'];
 const assets=paths.map(path=>[path,read('docs/'+path)]),release={...releaseDetails,id:hash(JSON.stringify([releaseDetails,js,assets,archive]))};
 write('docs/assets/app.js',js);for(const [path,text]of assets)write('docs/'+path,text);
 write('docs/release.json',JSON.stringify(release,null,2)+'\n');
 let html=read('docs/index.html').replace(/data-app-version="[a-f0-9]+"/,'data-app-version="'+hash(js)+'"').replace(/data-release-id="[a-f0-9]+"/,'data-release-id="'+release.id+'"').replace(/(<span class="version-chip"[^>]*>)[^<]+/,'$1v'+release.version+' · '+release.title);
 for(const [path,text] of assets)html=html.replaceAll(new RegExp('\\./'+path.replaceAll('.','\\.')+'\\?v=[a-f0-9]+','g'),'./'+path+'?v='+hash(text));
 html=html.replace('코드 자체 변경은 자동 감지할 수 없습니다. 새로운 버전 배포 시 버전명과 변경 내용을 등록해 주세요.','배포 변경사항은 자동으로 표시됩니다. 관리자는 별도 안내를 추가로 등록할 수 있습니다.');
 write('docs/index.html',html);
 console.log('배포 내역·버전·캐시 갱신 완료: v'+release.version);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)finalizeRelease();
