import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {saberDutyGroupV498,saberGroupsHtmlV498} from '../scripts/saber-groups.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('예도는 소속 중대 대신 근무 조직별로 통합된다',()=>{
 assert.equal(saberDutyGroupV498({unit:'전대'}),'전대 근무');
 assert.equal(saberDutyGroupV498({unit:'1대대'}),'대대 근무');assert.equal(saberDutyGroupV498({unit:'2대대'}),'대대 근무');
 for(let company=1;company<=8;company++)assert.equal(saberDutyGroupV498({unit:company+'중대'}),'중대 근무');
 assert.equal(saberDutyGroupV498({unit:'명예위원회'}),'명예위원회');
});
test('예도 그룹 안에서도 기존 자동 저장과 검색을 연결하며 비어 있는 그룹을 만들지 않는다',()=>{
 const source=read('docs/assets/app.js');assert.match(source,/data-saber-group/);assert.match(source,/list.map\(saberDutyGroupV498\)/);assert.match(source,/server\('saveSaberV276',id,input,item.updatedAt\)/);
 assert.match(read('docs/index.html'),/<div id="saberRowsV276"><\/div>/);
});
test('기존 예도 표 컨테이너를 그룹 테이블 컨테이너로 바꾼다',()=>{
 const html='<div class="eq-scroll"><table class="eq-table saber-table-v277"><thead><tr><th>조직</th></tr></thead><tbody id="saberRowsV276"></tbody></table></div>';
 assert.equal(saberGroupsHtmlV498(html),'<div id="saberRowsV276"></div>');
});
