import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarSegments, calendarHTML } from '../scripts/calendar.mjs';

test('사용자 재현 사례: 10월 7일~27일 진행 중 업무는 4·7·7·3일 막대로 이어진다', () => {
  const weeks=calendarSegments([{id:'test',date:'2026-10-07',due:'2026-10-27',workType:'long',status:'진행 중',title:'Test'}],'2026-09-27',35,'2026-10-27');
  const segments=weeks.flatMap(week=>week.segments);
  assert.deepEqual(segments.map(s=>s.span),[4,7,7,3]);
  assert.equal(segments.reduce((sum,s)=>sum+s.span,0),21);
});

test('장기업무가 주·월 경계를 가로질러 이어지고 같은 주에서 겹치지 않는다', () => {
  const entries = [
    { id: 'long', date: '2026-10-29', due: '2026-11-05', workType: 'long', status: '진행 중', title: '기간 업무' },
    { id: 'overlap', date: '2026-10-30', due: '2026-11-03', workType: 'long', status: '보류' },
    { id: 'daily', date: '2026-11-01', status: '미착수' }
  ];
  const weeks = calendarSegments(entries, '2026-10-25', 14, '2026-10-27');
  assert.equal(weeks[0].segments.find(s => s.entry.id === 'long').span, 3);
  const next = weeks[1].segments.find(s => s.entry.id === 'long');
  assert.equal(next.span, 5); assert.equal(next.continuesBefore, true);
  assert.equal(weeks[0].segments.find(s => s.entry.id === 'long').continuesAfter, true);
  for (const week of weeks) for (const a of week.segments) for (const b of week.segments) {
    if (a !== b && a.lane === b.lane) assert.ok(a.column + a.span <= b.column || b.column + b.span <= a.column);
  }
  assert.equal(weeks[1].segments.find(s => s.entry.id === 'daily').span, 1);
});
test('완료 업무는 완료일에 멈추고 마감이 지난 미완료 업무는 오늘까지 이어진다', () => {
  const entries = [
    { id: 'done', date: '2026-10-20', due: '2026-11-10', completedOn: '2026-10-27', workType: 'long', status: '완료' },
    { id: 'late', date: '2026-10-20', due: '2026-10-22', workType: 'long', status: '진행 중' }
  ];
  const week = calendarSegments(entries, '2026-10-25', 7, '2026-10-28')[0];
  assert.equal(week.segments.find(s => s.entry.id === 'done').span, 3);
  assert.equal(week.segments.find(s => s.entry.id === 'late').span, 4);
});
test('종료 미정 업무는 표시 범위까지 이어지며 제목·ID는 HTML로 실행되지 않는다', () => {
  const entry = { id: '"><img onerror=x>', date: '2026-10-25', workType: 'long', status: '진행 중', title: '<script>alert(1)</script>' };
  const html = calendarHTML([entry], { start: '2026-10-25', count: 7, today: '2026-10-27', selected: '2026-10-27', month: '2026-10' });
  assert.ok(html.includes('span 7')); assert.ok(html.includes('종료 미정'));
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('data-calendar-entry='));
});
