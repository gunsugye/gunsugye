export function normalizeSupplyDisplayStatus(value){
 const compact=String(value??'').normalize('NFKC').replace(/\s/g,'');
 if(compact==='정상')return '정상';
 if(compact.startsWith('수리필요'))return '수리 필요';
 if(compact==='사용불가'||compact==='교체필요')return '사용 불가';
 return '';
}
export function supplyStatusDisplay(source){
 const start=source.indexOf('function supplyMetricsOnly(){'),end=source.indexOf('function supplyRender(){',start);
 if(start<0||end<0)throw Error('군수품 상태 집계 위치를 찾지 못했습니다.');
 const replacement=`const normalizeSupplyDisplayStatus=${normalizeSupplyDisplayStatus.toString()};
function supplyMetricsOnly(){
 const rows=supplyItem?.rows||[],statuses=rows.map(x=>normalizeSupplyDisplayStatus(supplyDrafts.get(x.id)?.status??x.status));
 const metrics=[['관리 인원',rows.length],['정상',statuses.filter(x=>x==='정상').length],['수리 필요',statuses.filter(x=>x==='수리 필요').length],['사용 불가',statuses.filter(x=>x==='사용 불가').length],['미입력',statuses.filter(x=>!x).length],['수량 입력',rows.filter(x=>String((supplyDrafts.get(x.id)||x).extra?.['수량']??'').trim()!=='').length]];
 $('supplyMetrics').innerHTML=metrics.map(([a,b])=>\`<div class="roster-metric"><small>\${escapeH(a)}</small><strong>\${escapeH(b+'명')}</strong></div>\`).join('');
}
`;
 source=source.slice(0,start)+replacement+source.slice(end);
 const badge='repairBadgeV216(v.status)';if(!source.includes(badge))throw Error('군수품 상태 표시 위치를 찾지 못했습니다.');
 return source.replace(badge,"normalizeSupplyDisplayStatus(v.status)||'상태 확인'");
}
