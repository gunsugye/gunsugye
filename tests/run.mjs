import { existsSync } from 'node:fs';
await import('./api.test.mjs');
await import('./static.test.mjs');
await import('./journal.test.mjs');
await import('./deploy.test.mjs');
await import('./navigation.test.mjs');
await import('./calendar.test.mjs');
await import('./departures.test.mjs');
await import('./performance.test.mjs');
await import('./updates.test.mjs');
await import('./notifications.test.mjs');
if (existsSync(new URL('../Code.gs.txt', import.meta.url))) await import('./repairs.test.mjs');
await import('./room-assets.test.mjs');
await import('./room-assets-bulk.test.mjs');
if (existsSync(new URL('../apps-script/Legacy.gs', import.meta.url))) {
  await import('./apps-script.test.mjs');
} else {
  console.log('비공개 Legacy.gs가 없어 Apps Script 업무 통합 테스트는 로컬에서 실행합니다.');
}
