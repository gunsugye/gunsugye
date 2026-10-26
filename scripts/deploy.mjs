import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = resolve(root, '.deploy');
const gh = resolve(root, 'tools/github-cli/bin/gh.exe');
const clasp = resolve(root, 'node_modules/@google/clasp/build/src/index.js');
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const auth = resolve(state, 'google.json');
const configPath = resolve(state, 'config.json');
const environment = { ...process.env, GH_CONFIG_DIR: resolve(state, 'github'), XDG_CONFIG_HOME: resolve(state, 'cloudflare'), WRANGLER_LOG_PATH: resolve(state, 'logs'), WRANGLER_SEND_METRICS: 'false' };

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env: environment, stdio: options.capture ? [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) throw new Error(options.label || `${command.split(/[\\/]/).pop()} 실행 실패. 위 오류를 확인하세요.`);
  return result.stdout?.trim() || '';
}
const node = (script, args = [], options) => run(process.execPath, [script, ...args], options);
const google = (args, project, options) => node(clasp, ['-A', auth, ...(project ? ['-P', project] : []), ...args], options);

export function publicFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('업로드 대상에 심볼릭 링크가 있습니다.');
    if (entry.isDirectory()) return publicFiles(resolve(directory, entry.name), path);
    if (!entry.isFile()) throw new Error('일반 파일만 업로드할 수 있습니다.');
    if (/(^|\/)(?:\.deploy|\.clasp[^/]*|\.clasprc[^/]*|node_modules|tools|Code\.gs\.txt|Index\.html\.txt|Legacy\.gs|\.env[^/]*|\.dev\.vars)(\/|$)/i.test(path)) throw new Error(`비공개 파일은 업로드하지 않습니다: ${path}`);
    return [path];
  });
}

async function main() {
  const mode = process.argv[2] || '--check';
  mkdirSync(state, { recursive: true });
  if (mode === '--login-github') return run(gh, ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web', '--scopes', 'repo,workflow', '--skip-ssh-key']);
  if (mode === '--login-google') return google(['login', '--redirect-port', '53682']);
  if (mode === '--login-cloudflare') return node(wrangler, ['login', '--device', '--browser=false']);
  if (!['--check', '--publish', '--publish-site', '--dry-run'].includes(mode)) throw new Error('옵션: --check / --dry-run / --publish / --publish-site / --login-github / --login-google / --login-cloudflare');
  if (!existsSync(configPath)) throw new Error('.deploy/config.json 설정이 필요합니다. AUTO-DEPLOY.md를 확인하세요.');
  const config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  if (config.repository !== 'gunsugye/gunsugye' || !/^[\w-]{25,}$/.test(config.scriptId || '') || !/^[\w-]{25,}$/.test(config.deploymentId || '')) throw new Error('배포 대상 설정을 확인하세요.');
  if (['--dry-run', '--publish', '--publish-site'].includes(mode)) {
    node(resolve(root, 'scripts/build.mjs'));
    node(resolve(root, 'tests/run.mjs'));
    node(resolve(root, 'scripts/package.mjs'));
  }
  const release = resolve(root, 'release/github-upload'), files = publicFiles(release);
  if (!files.includes('docs/index.html') || !files.includes('.github/workflows/pages.yml')) throw new Error('필수 배포 파일이 없습니다.');
  if (mode === '--dry-run') { console.log(`검증 완료: 공개 파일 ${files.length}개. 실제 서버 변경 없음.`); return; }

  console.log('GitHub·Google·Cloudflare 인증 상태를 확인합니다.');
  run(gh, ['auth', 'status', '--hostname', 'github.com'], { capture: true, label: 'GitHub 로그인이 필요합니다: --login-github' });
  const api = async (path, method = 'GET', body) => {
    const args = ['api', `repos/${config.repository}${path}`, '--method', method, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'];
    if (body !== undefined) args.push('--input', '-');
    let response;
    try { response = run(gh, args, { capture: true, ...(body === undefined ? {} : { input: JSON.stringify(body) }), label: `GitHub ${method} ${path} 실패. 인증과 저장소 권한을 확인하세요.` }); }
    catch (error) { throw error; }
    return JSON.parse(response);
  };
  const repo = await api('');
  if (repo.default_branch !== 'main' || !repo.permissions?.push) throw new Error('main 브랜치와 저장소 쓰기 권한을 확인하세요.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let original = null;
  if (mode !== '--publish-site') {
  const cloudflareStatus = node(wrangler, ['whoami'], { capture: true, label: 'Cloudflare 로그인이 필요합니다: --login-cloudflare' });
  if (/not authenticated|not logged in/i.test(cloudflareStatus)) throw new Error('Cloudflare 로그인이 필요합니다: --login-cloudflare');
  node(wrangler, ['deployments', 'list', '--config', resolve(root, 'api/wrangler.toml')], { capture: true, label: '현재 Cloudflare 계정에서 기존 logbook-api를 확인할 수 없습니다.' });
  const runRoot = resolve(state, 'runs', stamp), remote = resolve(runRoot, 'apps-script');
  mkdirSync(remote, { recursive: true });
  const project = resolve(runRoot, '.clasp.json');
  writeFileSync(project, JSON.stringify({ scriptId: config.scriptId, rootDir: remote }, null, 2));
  google(['pull'], project);
  if (!existsSync(resolve(remote, 'appsscript.json'))) throw new Error('원격 Apps Script 매니페스트를 가져오지 못했습니다.');
  const deployments = google(['deployments'], project, { capture: true });
  if (!deployments.includes(config.deploymentId)) throw new Error('기존 웹 앱 배포ID가 이 프로젝트에 없습니다. 배포를 중단했습니다.');
  console.log('인증과 기존 배포 대상을 확인했습니다.');
  if (mode === '--check') return;

  const gatewayFiles = readdirSync(remote).filter(name => /\.(js|gs)$/.test(name) && readFileSync(resolve(remote, name), 'utf8').includes('function pagesVerifyRequest_('));
  if (gatewayFiles.length !== 1) throw new Error('새 API 프로젝트의 Gateway 파일을 하나로 식별하지 못했습니다. 기존 프로젝트를 덮어쓰지 않습니다.');
  const legacyFile = readdirSync(remote).find(name => /^Legacy\.(js|gs)$/.test(name));
  if (!legacyFile) throw new Error('원격 Legacy 파일이 없습니다. 프로젝트를 확인하세요.');
  original = resolve(runRoot, 'before-update');
  cpSync(remote, original, { recursive: true });
  cpSync(resolve(root, 'apps-script/Gateway.gs'), resolve(remote, gatewayFiles[0]));
  cpSync(resolve(root, 'apps-script/Legacy.gs'), resolve(remote, legacyFile));
  console.log('1/3 Apps Script 코드를 업로드하고 기존 웹 앱 배포를 갱신합니다.');
  google(['push', '--force'], project);
  google(['deploy', '-i', config.deploymentId, '-d', `자동 업데이트 ${stamp}`], project);
  console.log('2/3 Cloudflare Worker를 갱신합니다. 기존 변수와 Secret을 유지합니다.');
  node(wrangler, ['deploy', '--config', resolve(root, 'api/wrangler.toml'), '--keep-vars']);
  }
  console.log('3/3 공개 파일만 GitHub에 한 번의 커밋으로 업로드합니다.');
  const head = await api('/git/ref/heads/main');
  const parent = await api(`/git/commits/${head.object.sha}`);
  const tree = await api('/git/trees', 'POST', {
    base_tree: parent.tree.sha,
    tree: files.map(path => ({ path, mode: '100644', type: 'blob', content: readFileSync(resolve(release, path), 'utf8') }))
  });
  const commit = await api('/git/commits', 'POST', { message: `업무일지 업데이트 ${stamp}`, tree: tree.sha, parents: [head.object.sha] });
  await api('/git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false });
  writeFileSync(resolve(state, 'last-deployment.json'), JSON.stringify({ at: stamp, commit: commit.sha, backup: original ? relative(root, original).split(sep).join('/') : null }, null, 2));
  console.log(`GitHub 커밋: ${commit.html_url}`);
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await api(`/actions/runs?head_sha=${commit.sha}&per_page=10`);
    const workflow = result.workflow_runs.find(item => item.path === '.github/workflows/pages.yml');
    if (workflow?.status === 'completed') {
      if (workflow.conclusion !== 'success') throw new Error(`GitHub Pages 배포 실패: ${workflow.html_url}`);
      console.log('배포 완료: https://gunsugye.github.io/gunsugye/'); return;
    }
    console.log(`GitHub Pages 배포 ${workflow?.status || '시작 대기'}…`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error('GitHub 배포 대기 시간이 지났습니다. Actions 화면에서 완료 여부를 확인하세요.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
