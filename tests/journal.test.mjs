import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { journalVisibleOn, journalDuePassed } from '../scripts/journal.mjs';

test('마감시간이 지난 당일 업무만 지연으로 구분하고 날짜만 있는 기록은 하루 전체를 유지한다', () => {
  assert.equal(journalDuePassed({due:'2026-10-27',dueTime:'09:30'},'2026-10-27','10:00'),true);
  assert.equal(journalDuePassed({due:'2026-10-27',dueTime:'11:30'},'2026-10-27','10:00'),false);
  assert.equal(journalDuePassed({due:'2026-10-27'},'2026-10-27','23:59'),false);
});

test('다시 불러오기와 백업 가져오기에서 업무유형·완료일을 유지한다', () => {
  const app = readFileSync(new URL('../docs/assets/app.js', import.meta.url), 'utf8');
  const fragment = app.slice(app.indexOf('function normalizeData('), app.indexOf('function makeId('));
  const context = vm.createContext({ STATUSES: ['진행 중','완료'], PRIORITIES: ['보통'], DEFAULT_CATS: ['행정'], makeId: () => 'new' });
  new vm.Script(fragment).runInContext(context);
  const data = context.normalizeData({ categories: ['행정'], notes: {}, entries: [{ id: 'long', date: '2026-10-20', workType: 'long', status: '완료', completedOn: '2026-10-27' }] });
  assert.equal(data.entries[0].workType, 'long'); assert.equal(data.entries[0].completedOn, '2026-10-27');
});

test('당일업무는 지정일만, 장기업무는 시작일부터 완료일까지 중복 생성 없이 표시한다', () => {
  const entry = { date: '2026-10-20', status: '진행 중' };
  assert.equal(journalVisibleOn(entry, '2026-10-21'), false);
  assert.equal(journalVisibleOn(entry, '2026-10-20'), true);
  entry.workType = 'long';
  assert.equal(journalVisibleOn(entry, '2026-10-19'), false);
  assert.equal(journalVisibleOn(entry, '2026-11-15'), true);
  entry.status = '보류'; assert.equal(journalVisibleOn(entry, '2026-11-15'), true);
  entry.status = '완료'; entry.completedOn = '2026-10-27';
  assert.equal(journalVisibleOn(entry, '2026-10-26'), true);
  assert.equal(journalVisibleOn(entry, '2026-10-27'), true);
  assert.equal(journalVisibleOn(entry, '2026-10-28'), false);
});
const sourceUrl = new URL('../Code.gs.txt', import.meta.url);
if (existsSync(sourceUrl)) test('완료일은 서버 날짜로 기록하고 재수정시 보존하며 재개하면 해제한다', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  const fragment = source.slice(source.indexOf('function entryRow_('), source.indexOf('function findEntry_('));
  const context = vm.createContext({
    LOGBOOK: { STATUSES: ['미착수','진행 중','완료','보류'], PRIORITIES: ['보통','높음','긴급'] },
    Utilities: { getUuid: () => 'id', formatDate: () => '2026-10-27' },
    text_: (v, n) => String(v || '').trim().slice(0, n), date_: v => v || ''
  });
  new vm.Script(fragment).runInContext(context);
  const input = { title: '장기 업무', date: '2026-10-20', workType: 'long', status: '완료' };
  const done = context.entryRow_(input, '2026-10-27T01:00:00Z', null);
  assert.equal(done.completedOn, '2026-10-27');
  assert.equal(context.entryRow_(input, '2026-10-28T01:00:00Z', done).completedOn, done.completedOn);
  assert.equal(context.entryRow_({ ...input, status: '진행 중' }, '2026-10-28T01:00:00Z', done).completedOn, '');
  assert.equal(context.entryRow_({ title: '기존 업무', date: input.date }, '2026-10-28T01:00:00Z', null).workType, 'daily');
  assert.throws(() => context.entryRow_({ ...input, workType: 'invalid' }, '2026-10-28T01:00:00Z', null));
});

if (existsSync(sourceUrl)) test('유형을 실제 저장 열에 함께 쓰고 다시 읽으며 열 충돌과 동시 수정을 차단한다', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  const fields = ['id','date','time','category','title','status','priority','due','owner','detail','follow','createdAt','updatedAt'];
  const rows = [fields.slice()], sheet = {
    deleteRow(row) { rows.splice(row-1,1); },
    getMaxColumns: () => 26, getMaxRows: () => 100, getLastRow: () => rows.length,
    getRange(row, col, height = 1, width = 1) {
      return {
        getDisplayValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[col - 1 + j] || '')),
        getDisplayValue: () => rows[row - 1]?.[col - 1] || '',
        setValues(values) { values.forEach((valuesRow, i) => valuesRow.forEach((v, j) => { rows[row - 1 + i] ||= []; rows[row - 1 + i][col - 1 + j] = String(v); })); return this; },
        setNumberFormat() { return this; }
      };
    }
  };
  let timestamp = '2026-10-27T01:00:00Z';
  const context = vm.createContext({
    LOGBOOK: { ENTRY_FIELDS: fields, ENTRY: '업무기록', MAX_RECORDS: 5000, STATUSES: ['미착수','진행 중','완료','보류'], PRIORITIES: ['보통','높음','긴급'] },
    Utilities: { getUuid: () => 'id', formatDate: () => '2026-10-27' },
    text_: (v, n) => String(v || '').trim().slice(0, n), date_: v => v || '', safeCell_: String,
    iso_: () => timestamp, requireJournalEditorV226_() {}, lockAndRun_: fn => fn(),
    spreadsheet_: () => ({ getSheetByName: () => sheet }), ensureRows_() {}, writeAudit_() {}
  });
  new vm.Script(source.slice(source.indexOf('function journalSchemaV300_('), source.indexOf('function getBootstrap(')) + '\n' + source.slice(source.indexOf('function entryRow_('), source.indexOf('function saveNote('))).runInContext(context);
  const saved = context.saveEntry({ title: '진행 업무', date: '2026-10-20', time:'09:00',due:'2026-10-27',dueTime:'17:30',status: '진행 중', workType: 'long' });
  assert.equal(rows[1][15], '17:30');
  assert.equal(context.findEntry_(sheet,'id').entry.dueTime, '17:30');
  assert.throws(()=>context.saveEntry({...saved,dueTime:'24:00'}),/마감시간/);
  assert.throws(()=>context.saveEntry({...saved,due:''}),/마감일/);
  assert.throws(()=>context.saveEntry({...saved,due:'2026-10-20',dueTime:'08:00'}),/시작 일시/);
  assert.equal(rows[1][13], 'long');
  assert.equal(context.findEntry_(sheet, 'id').entry.workType, 'long');
  timestamp = '2026-10-27T02:00:00Z';
  const done = context.saveEntry({ ...saved, status: '완료' });
  assert.equal(rows[1][14], '2026-10-27');
  assert.equal(context.findEntry_(sheet, 'id').entry.completedOn, done.completedOn);
  assert.throws(() => context.saveEntry(saved), /다른 화면/);
  rows[0][13] = '기존 다른 자료';
  assert.throws(() => context.saveEntry({ ...done, title: '수정' }), /다른 자료/);
  assert.equal(rows[1][4], '진행 업무');
  rows[0][13]='업무유형';
  assert.throws(()=>context.removeEntry('id',saved.updatedAt),/다른 화면/);
  assert.equal(rows.length,2);
  context.removeEntry('id',done.updatedAt);
  assert.equal(rows.length,1);
});
