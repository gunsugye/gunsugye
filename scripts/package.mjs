import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'release/github-upload');
// 명시한 파일만 복사합니다. 원본/Legacy/실행 파일/환경 변수는 포함하지 않습니다.
const paths = ['.github', '.gitignore', 'README.md', 'DEPLOY.md', 'UPDATE.md', 'AUTO-DEPLOY.md', 'package.json', 'package-lock.json', 'docs', 'api', 'scripts', 'tests', 'apps-script/Gateway.gs', 'apps-script/methods.json'];
mkdirSync(out, { recursive: true });
for (const path of paths) {
  const destination = resolve(out, path);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(resolve(root, path), destination, { recursive: true });
}
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
writeFileSync(resolve(out, 'README.md'), readme, 'utf8');
console.log('GitHub 업로드용 파일: release/github-upload (비공개 업무 원본 제외)');
