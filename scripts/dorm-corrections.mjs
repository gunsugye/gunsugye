export function correctDormSource(source,fix){
 for(const name of ['DORM_PDF_ROSTER_V240','DORM_PDF_ROSTER_V241']){
  const pattern=new RegExp('(const '+name+'=)(\\[[^\\n]+\\]);');
  source=source.replace(pattern,(_all,prefix,raw)=>{
   const rows=JSON.parse(raw);
   for(const row of rows)if(row[0]===fix.building&&row[1]===fix.floor&&[fix.fromRoom,fix.room].includes(row[3])&&fix.names.includes(row[6])){
    row[3]=fix.room;row[4]=fix.cohort;row[5]=fix.company;row[8]='확인';
   }
   return prefix+JSON.stringify(rows)+';';
  });
 }
 source=source.replace(/(const DORM_PDF_ROOMS_V243=)(\[[^\n]+\]);/,(_all,prefix,raw)=>{const rows=JSON.parse(raw);for(const row of rows)if(row[0]===fix.building&&row[1]===fix.floor&&row[3]===fix.fromRoom){row[3]=fix.room;row[6]=fix.group;}return prefix+JSON.stringify(rows)+';';});
 source=source.replace('"east|3|343-4":"4|3|S|M",','"east|3|343-3":"4|3|S|M",\n "east|3|343-4":"4|3|S|M",');
 // 원본 이름만 같다는 이유로 다른 기수·중대의 생도를 병합하지 않습니다.
 source=source.replace('x.original&&x.original===a.original','x.original&&x.original===a.original&&x.cohort===a.cohort&&x.company===a.company')
 .replace('x.original===original||x.name===name&&x.cohort===String(cohort)&&x.company===String(company)', '(x.original===original||x.name===name)&&x.cohort===String(cohort)&&x.company===String(company)');
 return source;
}
export function correctDormClient(js){
 js=js.replace(/(const DORM_REPORT_TSV_V235=)("[^\n]+");/,(_all,prefix,raw)=>{
  const lines=JSON.parse(raw).split('\n').map(line=>{const r=line.split('\t');if(r[0]==='정예 동관'&&r[1]==='3층'&&r[3]==='343-4'){r[3]='343-3';r[8]='3중대';}return r.join('\t');});
  return prefix+JSON.stringify(lines.join('\n'))+';';
 });
 const hook='ready=true;navAfterCloudV220(result);';
 if(!js.includes(hook))throw Error('생활실 정정 시작 위치를 확인하세요.');
 return js.replace(hook,`ready=true;if(canManageUsersV281)server('applyDormCorrectionsV315').then(r=>{if(r.changed){dormLoadedV234=false;toast('343-3호 배정 정정 완료 · 변경 전 기록을 백업했습니다.');if(view==='dorm'){dormReloadV234();if(dormPlanV315)dormPlanLoadV315();}}else if(r.review)toast('343-3호 정정 확인 필요: '+r.message);}).catch(e=>toast('생활실 정정 확인 실패: '+e.message));navAfterCloudV220(result);`);
}
