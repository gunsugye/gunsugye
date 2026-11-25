import { existsSync } from 'node:fs';
if (existsSync(new URL('../Code.gs.txt', import.meta.url))) await import('./supabase-person-supplies.test.mjs');
await import('./supabase-snapshot.test.mjs');
await import('./supabase-store.test.mjs');
await import('./training-candidates.test.mjs');
await import('./saber-groups.test.mjs');
await import('./condition-states.test.mjs');
await import('./armory.test.mjs');
await import('./instructor-portal.test.mjs');
await import('./survey-periods.test.mjs');
await import('./survey-forms.test.mjs');
await import('./supply-survey-people.test.mjs');
await import('./roster-firearm-audit.test.mjs');
await import('./repair-unification.test.mjs');
await import('./person-groups.test.mjs');
await import('./managed-delete.test.mjs');
await import('./api.test.mjs');
await import('./static.test.mjs');
await import('./journal.test.mjs');
await import('./deploy.test.mjs');
await import('./pages-deploy.test.mjs');
await import('./navigation.test.mjs');
await import('./calendar.test.mjs');
await import('./departures.test.mjs');
await import('./performance.test.mjs');
if (existsSync(new URL('../Code.gs.txt', import.meta.url))) await import('./supply-save-speed.test.mjs');
await import('./updates.test.mjs');
await import('./development-requests.test.mjs');
await import('./notifications.test.mjs');
if (existsSync(new URL('../Code.gs.txt', import.meta.url))) await import('./repairs.test.mjs');
await import('./room-assets.test.mjs');
await import('./asset-residents.test.mjs');
await import('./room-assets-bulk.test.mjs');
await import('./dorm-plan.test.mjs');
await import('./labor-interface.test.mjs');
await import('./labor-absence.test.mjs');
if (existsSync(new URL('../Code.gs.txt', import.meta.url))) await import('./labor-duty-groups.test.mjs');
await import('./personal-interface.test.mjs');
await import('./duty-cadets.test.mjs');
await import('./duty-person-editor.test.mjs');
await import('./duty-roles.test.mjs');
await import('./duty-items.test.mjs');
await import('./duty-manual.test.mjs');
await import('./duty-roster-ui.test.mjs');
await import('./duty-verification.test.mjs');
await import('./duty-order.test.mjs');
await import('./staff-email.test.mjs');
await import('./asset-overview.test.mjs');
await import('./asset-plan.test.mjs');
await import('./asset-initialization.test.mjs');
await import('./personal.test.mjs');
await import('./personal-duty.test.mjs');
await import('./personal-all-review.test.mjs');
await import('./personal-session.test.mjs');
await import('./asset-requests.test.mjs');
await import('./asset-inspection.test.mjs');
await import('./asset-inspection-client.test.mjs');
await import('./asset-inspection-layout.test.mjs');
await import('./uniform-requests.test.mjs');
await import('./training-management.test.mjs');
await import('./dorm-corrections.test.mjs');
if (existsSync(new URL('../apps-script/Legacy.gs', import.meta.url))) {
  await import('./apps-script.test.mjs');
} else {
  console.log('비공개 Legacy.gs가 없어 Apps Script 업무 통합 테스트는 로컬에서 실행합니다.');
}

await import('./supply-schema.test.mjs');

await import('./reference-batch.test.mjs');

await import('./firearms.test.mjs');

await import('./roster-linkage.test.mjs');

await import('./firearm-requests.test.mjs');
await import('./supply-quantity-order.test.mjs');
await import('./quantity-colors.test.mjs');
await import('./supply-requests.test.mjs');
await import('./supply-inbox.test.mjs');
await import('./supply-forms.test.mjs');
await import('./supply-survey-lifecycle.test.mjs');
await import('./supply-form-korean.test.mjs');
import './supply-blueprints.test.mjs';
await import('./supabase-runtime.test.mjs');
import './supply-overview.test.mjs';
await import('./supply-source-sync.test.mjs');
