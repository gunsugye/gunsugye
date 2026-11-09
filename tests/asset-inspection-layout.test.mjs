import test from 'node:test';
import assert from 'node:assert/strict';
import { assetInspectionModelV382 } from '../scripts/asset-inspection.mjs';
import { assetInspectionLayoutV384 } from '../scripts/asset-inspection-layout.mjs';

function fixture() {
 return {
  rooms: [
   { id: 'main', building: '정예 본관', floor: '1층', room: '132-1', group: '1중대' },
   { id: 'east', building: '정예 동관', floor: '1층', room: '110', group: '2중대' }
  ],
  items: [
   { id: 'bed', name: '침대틀', positions: ['1', '2'] },
   { id: 'fan', name: '선풍기', positions: ['common'] }
  ],
  records: [
   { roomId: 'main', itemId: 'bed', slots: [{ position: '1', status: '수리 필요', details: '볼트 풀림' }, { position: '2', status: '수리 필요', details: '볼트 풀림' }] },
   { roomId: 'main', itemId: 'fan', slots: [{ position: 'common', status: '교체 필요', details: '모터 고장' }] }
  ]
 };
}

test('참고 시트 배치와 실제 자리별 수량을 보존하며 입력 모델은 변경하지 않는다', () => {
 const model = assetInspectionModelV382(fixture(), '2026-11-03');
 const before = JSON.stringify(model);
 const layout = assetInspectionLayoutV384(model, '2026-11-03');
 assert.equal(JSON.stringify(model), before);
 assert.equal(layout.header, 11);
 assert.equal(layout.sheets[0].header, 11);
 assert.equal(layout.dashboard.headerRow, 12);
 assert.equal(layout.dashboard.endRow, 14);
 assert.equal(layout.sheets[0].width, 20);
 assert.ok(layout.sheets[0].rows.every(row => row.length === 20));
 const rows = layout.sheets[0].rows;
 assert.equal(rows[1][1], '생활실 비품 상태 점검 및 관리 대시보드');
 assert.match(rows[2][1], /2026-11-03/);
 assert.deepEqual(rows[4].filter(Boolean).slice(0, 5), ['총 점검 호실', '비품 정상(양호)율', '조치 필요 총 비품', '조치 대상 호실', '정상 호실 수']);
 assert.deepEqual(rows[12].slice(0, 17), model.sheets[0].rows[model.header + 1]);
 assert.equal(rows[12][6], '수리필요');
 assert.equal(rows[12][14], 3, '침대 두 자리와 양식 외 선풍기의 불량 3건을 모두 보존');
 assert.equal(rows[12][15], '조치대상');
 assert.equal(rows[12][16], '침대틀(1번): 볼트 풀림\n침대틀(2번): 볼트 풀림\n선풍기: 모터 고장');
 assert.deepEqual(rows[12].slice(17), [3, 0, 0]);
 assert.deepEqual(rows[13].slice(17), [0, 0, 3]);
 assert.strictEqual(layout.sheets[1], model.sheets[1]);
 assert.deepEqual(layout.dashboard.buildingRows, [{ building: '정예 본관', row: 7 }, { building: '정예 동관', row: 8 }]);
 assert.equal(layout.dashboard.totalRow, 9);
 assert.ok(layout.dashboard.merges.includes('B2:Q2'));
 assert.ok(layout.dashboard.merges.includes('B3:Q3'));
 assert.ok(layout.dashboard.merges.includes('B6:C7'));
 assert.deepEqual(layout.dashboard.percentCells, ['D6', 'Q7', 'Q8', 'Q9']);
});

test('집계 수식은 대표 상태 개수 대신 전체 데이터의 실제 수량 보조 열을 참조한다', () => {
 const layout = assetInspectionLayoutV384(assetInspectionModelV382(fixture(), ''), '');
 const rows = layout.sheets[0].rows;
 assert.deepEqual(rows[5][1], { formula: '=COUNTIF($R$13:$R$14,">0")' });
 assert.deepEqual(rows[5][3], { formula: '=IFERROR(SUM($S$13:$S$14)/SUM($R$13:$R$14),0)' });
 assert.deepEqual(rows[5][5], { formula: '=SUM($O$13:$O$14)' });
 assert.deepEqual(rows[5][7], { formula: '=COUNTIF($O$13:$O$14,">0")' });
 assert.deepEqual(rows[5][9], { formula: '=COUNTIF($P$13:$P$14,"정상")' });
 assert.match(rows[8][1].formula, /SUM\(\$T\$13:\$T\$14\)/);
 assert.deepEqual(rows[6][14], { formula: '=COUNTIFS($D$13:$D$14,$M7,$R$13:$R$14,">0")' });
 assert.deepEqual(rows[6][15], { formula: '=SUMIF($D$13:$D$14,$M7,$O$13:$O$14)' });
 assert.deepEqual(rows[6][16], { formula: '=IFERROR(COUNTIFS($D$13:$D$14,$M7,$P$13:$P$14,"정상")/O7,0)' });
 assert.ok(rows.flat().filter(cell => cell && typeof cell === 'object').every(cell => typeof cell.formula === 'string' && cell.formula.startsWith('=')));
});

test('건물 다섯 곳 이상에서도 요약과 호실 표가 겹치지 않고 마지막 호실까지 집계한다', () => {
 const data = fixture();
 data.rooms = Array.from({ length: 6 }, (_, i) => ({ id: 'r' + i, building: '건물' + i, floor: '1층', room: String(101 + i), group: (i + 1) + '중대' }));
 data.records = [];
 const layout = assetInspectionLayoutV384(assetInspectionModelV382(data, ''), '');
 assert.equal(layout.dashboard.headerRow, 15);
 assert.equal(layout.dashboard.totalRow, 13);
 assert.equal(layout.dashboard.endRow, 21);
 assert.ok(layout.dashboard.totalRow < layout.dashboard.headerRow - 1);
 assert.equal(layout.sheets[0].rows[12][12], '합계');
 assert.equal(layout.sheets[0].rows[13][1], '생활실별 비품 점검 현황표');
 assert.equal(layout.sheets[0].rows[14][0], 'NO');
 assert.equal(layout.sheets[0].rows[20][1], '106');
 assert.match(layout.sheets[0].rows[5][1].formula, /\$R\$16:\$R\$21/);
 assert.ok(layout.sheets[0].rows.every(row => row.length === 20));
 data.rooms = data.rooms.slice(0, 4);
 assert.equal(assetInspectionLayoutV384(assetInspectionModelV382(data, ''), '').dashboard.headerRow, 12);
});

test('소속이 섞인 건물도 실제 건물 이름과 중대를 유지한다', () => {
 const data = fixture();
 data.rooms.push({ id: 'other', building: '정예 본관', floor: '2층', room: '255', group: '7중대' });
 const layout = assetInspectionLayoutV384(assetInspectionModelV382(data, ''), '');
 assert.equal(layout.sheets[0].rows[6][12], '정예 본관');
 assert.equal(layout.sheets[0].rows[6][13], '1중대 · 7중대');
 const other = layout.sheets[0].rows.find(row => row[1] === '255');
 assert.equal(other[2], '7중대');
 assert.equal(other[3], '정예 본관');
});

test('빈 명단에서도 유효한 수식 범위와 정해진 표 너비를 유지한다', () => {
 const layout = assetInspectionLayoutV384(assetInspectionModelV382({ rooms: [], items: [], records: [] }, ''), '');
 assert.equal(layout.dashboard.headerRow, 12);
 assert.equal(layout.dashboard.endRow, 12);
 assert.equal(layout.dashboard.totalRow, 7);
 assert.deepEqual(layout.dashboard.buildingRows, []);
 assert.equal(layout.sheets[0].rows.length, 12);
 assert.ok(layout.sheets[0].rows.every(row => row.length === 20));
 assert.deepEqual(layout.sheets[0].rows[5][1], { formula: '=COUNTIF($R$13:$R$13,">0")' });
});
