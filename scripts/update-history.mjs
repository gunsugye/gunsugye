export function updateHistoryJs(js, client) {
 const pattern=/async function v285UpdateLoad\(\)\{[\s\S]*?\nasync function v285UpdateSave\(/;
 if(!pattern.test(js))throw Error('업데이트 내역 함수 위치를 찾지 못했습니다.');
 return js.replace(pattern,client+'\nasync function v285UpdateSave(');
}
