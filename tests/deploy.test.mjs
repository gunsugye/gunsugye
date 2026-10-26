import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicFiles } from '../scripts/deploy.mjs';

test('자동 배포는 공개 파일만 허용하고 업무 원본·인증 파일 업로드를 차단한다', () => {
  const directory = mkdtempSync(join(tmpdir(), 'logbook-deploy-test-'));
  const publicFile = join(directory, 'index.html');
  writeFileSync(publicFile, '<html></html>');
  try {
    assert.deepEqual(publicFiles(directory), ['index.html']);
    for (const name of ['Legacy.gs', 'Code.gs.txt', '.clasprc.json', '.env']) {
      const path = join(directory, name); writeFileSync(path, 'test');
      try { assert.throws(() => publicFiles(directory), /비공개/); } finally { unlinkSync(path); }
    }
  } finally { unlinkSync(publicFile); rmdirSync(directory); }
});
