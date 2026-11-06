// Publish reviewed tracked source through the existing GitHub Pages workflow.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = resolve(root, 'tools/git/cmd/git.exe');
const gh = resolve(root, 'tools/github-cli/bin/gh.exe');
const env = { ...process.env, GH_CONFIG_DIR: resolve(root, '.deploy/github'), PATH: `${resolve(root, 'tools/git/cmd')};${process.env.PATH || ''}` };
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error || result.status !== 0) throw Error(`Command failed: ${args[0]}`);
  return result.stdout?.trim();
}
run(process.execPath, ['tests/run.mjs']);
run(gh, ['auth', 'status']);
const repo = JSON.parse(run(gh, ['api', 'repos/gunsugye/gunsugye'], true));
if (!repo.permissions?.push) throw Error('GitHub repository write permission is required.');
if (run(git, ['remote', 'get-url', 'origin'], true) !== 'https://github.com/gunsugye/gunsugye.git') throw Error('Unexpected origin.');
run(git, ['fetch', 'origin', 'main']);
const branch = run(git, ['branch', '--show-current'], true);
if (branch !== 'main') throw Error('Publish from main only.');
run(git, ['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
run(gh, ['auth', 'setup-git']);
// Track updates plus the reviewed workspace helpers; never add the entire checkout.
run(git, ['add', '-u']);
run(git, ['add', '--', 'WORKSPACE.md', 'workspace.ps1', 'scripts/dev-server.mjs', 'scripts/publish-site.mjs']);
const staged = run(git, ['diff', '--cached', '--name-only'], true);
if (staged.split('\n').some(path => /(^|\/)(?:\.tools|\.setup|\.deploy|\.git|node_modules|tools|Code\.gs\.txt|Index\.html\.txt|Legacy\.gs|\.env[^/]*|\.dev\.vars|\.clasp[^/]*|\.clasprc[^/]*)(\/|$)/i.test(path))) throw Error('Private files are staged. Review the staging area before publishing.');
if (staged) run(git, ['-c', `user.name=${repo.owner.login}`, '-c', `user.email=${repo.owner.id}+${repo.owner.login}@users.noreply.github.com`, 'commit', '-m', 'Update site from local workspace']);
run(git, ['push', 'origin', 'main']);
console.log('Pushed to GitHub. Deployment status: https://github.com/gunsugye/gunsugye/actions');
