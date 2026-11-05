export function assetInspectionLayoutV384(model, at) {
 const main = model?.sheets?.[0];
 if (!main || !Array.isArray(model.rooms)) throw Error('생활실 점검표 자료를 확인하세요.');
 const rooms = model.rooms;
 const buildings = [...new Set(rooms.map(entry => entry.room.building))];
 const headerRow = buildings.length >= 5 ? buildings.length + 9 : 12;
 const firstRow = headerRow + 1;
 const endRow = headerRow + rooms.length;
 const formulaEndRow = Math.max(firstRow, endRow);
 const rows = Array.from({ length: endRow }, () => Array(20).fill(''));
 const put = (row, column, value) => { rows[row - 1][column - 1] = value; };
 const formula = text => ({ formula: text });
 const range = column => '$' + column + '$' + firstRow + ':$' + column + '$' + formulaEndRow;
 const known = range('R'), normal = range('S'), unknown = range('T');
 const bad = range('O'), result = range('P'), building = range('D');

 put(2, 2, '생활실 비품 상태 점검 및 관리 대시보드');
 put(3, 2, '정리일시: ' + at + ' · 저장된 기록 기준 · 점검일은 자리별 수정시각 참조');
 const labels = ['총 점검 호실', '비품 정상(양호)율', '조치 필요 총 비품', '조치 대상 호실', '정상 호실 수'];
 const values = [
  '=COUNTIF(' + known + ',">0")',
  '=IFERROR(SUM(' + normal + ')/SUM(' + known + '),0)',
  '=SUM(' + bad + ')',
  '=COUNTIF(' + bad + ',">0")',
  '=COUNTIF(' + result + ',"정상")'
 ];
 labels.forEach((label, i) => {
  put(5, 2 + i * 2, label);
  put(6, 2 + i * 2, formula(values[i]));
 });
 put(9, 2, formula('="등록 호실 "&COUNTA(' + range('B') + ')&"개실 · 미점검 비품 "&SUM(' + unknown + ')&"개 · 전체 등록 품목 기준"'));

 put(5, 13, '건물별 비품 점검 집계 현황');
 ['구분(건물)', '배치 중대', '점검 호실 수', '조치 필요 비품', '정상 호실 비율'].forEach((value, i) => put(6, 13 + i, value));
 const buildingRows = buildings.map((name, i) => {
  const row = 7 + i;
  const groups = [...new Set(rooms.filter(entry => entry.room.building === name).flatMap(entry => entry.allocation?.companies?.length ? entry.allocation.companies : [entry.room.group]).filter(Boolean))];
  put(row, 13, name);
  put(row, 14, groups.join(' · '));
  put(row, 15, formula('=COUNTIFS(' + building + ',$M' + row + ',' + known + ',">0")'));
  put(row, 16, formula('=SUMIF(' + building + ',$M' + row + ',' + bad + ')'));
  put(row, 17, formula('=IFERROR(COUNTIFS(' + building + ',$M' + row + ',' + result + ',"정상")/O' + row + ',0)'));
  return { building: name, row };
 });
 const totalRow = 7 + buildings.length;
 put(totalRow, 13, '합계');
 put(totalRow, 14, '전체');
 put(totalRow, 15, formula(values[0]));
 put(totalRow, 16, formula(values[2]));
 put(totalRow, 17, formula('=IFERROR(COUNTIF(' + result + ',"정상")/COUNTIF(' + known + ',">0"),0)'));
 put(headerRow - 1, 2, '생활실별 비품 점검 현황표');

 const originalHeader = main.rows[model.header];
 rows[headerRow - 1] = [...originalHeader.slice(0, 17), '기록 비품 수', '정상 비품 수', '미점검 비품 수'];
 rooms.forEach((entry, i) => {
  const original = main.rows[model.header + 1 + i];
  rows[headerRow + i] = [...original.slice(0, 17), entry.known, entry.normal, entry.unknown];
 });
 const merges = ['B2:Q2', 'B3:Q3', 'B9:K9', 'B5:C5', 'D5:E5', 'F5:G5', 'H5:I5', 'J5:K5', 'B6:C7', 'D6:E7', 'F6:G7', 'H6:I7', 'J6:K7', 'M5:Q5'];
 const percentCells = ['D6', ...buildingRows.map(entry => 'Q' + entry.row), 'Q' + totalRow];
 return {
  ...model,
  header: headerRow - 1,
  dashboard: { headerRow, endRow, buildingRows, totalRow, merges, percentCells },
  sheets: [{ ...main, width: 20, header: headerRow - 1, rows }, ...model.sheets.slice(1)]
 };
}
