import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { normalizeNavigation } from '../scripts/navigation.mjs';

const app = readFileSync(new URL('../docs/assets/app.js', import.meta.url), 'utf8');
const constants = app.slice(app.indexOf('const NAV_GROUP_DEFAULT_V233='), app.indexOf('let navSavedOrderV220='));
const constantsContext = vm.createContext({});
new vm.Script(constants + '\nglobalThis.defaults=NAV_GROUP_DEFAULT_V233;globalThis.allowed=NAV_BUILTIN_V233;').runInContext(constantsContext);
const defaults = JSON.parse(JSON.stringify(constantsContext.defaults)), allowed = Array.from(constantsContext.allowed);

test('예전 숨김 메뉴는 구성에서 제거하고 반복 조회해도 다시 끼워 넣지 않는다', () => {
  const old = { groups: defaults, labels: { surveys: '조사', today: '오늘' }, hiddenGroups: ['admin'], hiddenItems: ['uniform'] };
  const current = normalizeNavigation(old, defaults, allowed);
  assert.ok(!current.groups.some(g => g.id === 'admin'));
  assert.ok(!current.groups.flatMap(g => g.items).includes('surveys'));
  assert.ok(!current.groups.flatMap(g => g.items).includes('uniform'));
  assert.equal(current.labels.surveys, undefined);
  assert.deepEqual(normalizeNavigation(current, defaults, allowed), current);
  assert.equal('hiddenGroups' in current, false);
});
test('상위 메뉴와 하위 메뉴를 실제 제거한 구성, 빈 구성도 그대로 유지한다', () => {
  const current = normalizeNavigation({ schemaVersion: 2, departuresAddedV305:true, groups: [{ id: 'journal', title: '일지', items: ['today'] }], labels: { all: '삭제된 이름' } }, defaults, allowed);
  assert.equal(current.groups.length, 1); assert.deepEqual(current.groups[0].items, ['today']); assert.deepEqual(current.labels, {});
  assert.deepEqual(normalizeNavigation({ schemaVersion: 2, departuresAddedV305:true, groups: [], labels: {} }, defaults, allowed).groups, []);
});

const sourceUrl = new URL('../Code.gs.txt', import.meta.url);
if (existsSync(sourceUrl)) test('화면과 서버 메뉴 목록이 같고 행정 재추가·삭제 저장·중복 검사가 동작한다', () => {
  const source = readFileSync(sourceUrl, 'utf8'), values = new Map();
  const context = vm.createContext({
    navModelV301_: normalizeNavigation, requireOwner_() {}, lockAndRun_: fn => fn(),
    wxPages_: () => [], spreadsheet_: () => ({}),
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => values.get(key), setProperty: (key, value) => values.set(key, value) }) }
  });
  const fragment = source.slice(source.indexOf("const NAV_PROP_V233="), source.indexOf('/** v2.38: suffix'));
  new vm.Script(fragment + '\nglobalThis.allowed=NAV_FIXED_V233;').runInContext(context);
  assert.deepEqual(Array.from(context.allowed).sort(), allowed.slice().sort());
  const restored = { schemaVersion: 2, departuresAddedV305:true, groups: [{ id: 'admin', title: '행정', items: ['surveys'] }, { id: 'uniform', title: '피복', items: ['uniform'] }, { id: 'other', title: '기타', items: ['updates'] }], labels: {} };
  const saved = context.saveNavTreeV233(restored);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.groups)), restored.groups);
  assert.throws(() => context.saveNavTreeV233({ ...restored, groups: [...restored.groups, { id: 'journal', items: ['surveys'] }] }), /중복/);
  const removed = context.saveNavTreeV233({ schemaVersion: 2, departuresAddedV305:true, groups: [], labels: {} });
  assert.equal(removed.groups.length, 0); assert.equal(context.navTreeV233_().groups.length, 0);
});

test('새 일괄 관리 상위 메뉴는 기존 구성에 한 번만 추가되고 이후 삭제를 존중한다',()=>{
 const migrated=normalizeNavigation({schemaVersion:2,groups:[{id:'journal',items:['today']}]},defaults,allowed);
 assert.equal(migrated.groups.filter(g=>g.id==='departures').length,1);
 migrated.groups=migrated.groups.filter(g=>g.id!=='departures');
 assert.equal(normalizeNavigation(migrated,defaults,allowed).groups.some(g=>g.id==='departures'),false);
});
