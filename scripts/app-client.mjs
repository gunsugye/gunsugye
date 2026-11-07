export function insertAppClient(source,client){
 if(!/^init\(\);$/m.test(source))throw Error('관리 앱 초기화 위치를 확인하세요.');
 return source.replace(/^init\(\);$/m,()=>client+'\ninit();');
}
