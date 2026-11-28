param([ValidateSet('dev','test','status','login','publish-site','check-deploy')][string]$Action = 'dev')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodePath = Join-Path $PSScriptRoot 'tools/node.exe'
if (!$nodePath) { throw 'Local Node.js is missing.' }
$env:PATH = (Split-Path $nodePath) + ';' + (Join-Path $PSScriptRoot 'tools/git/cmd') + ';' + (Join-Path $PSScriptRoot 'tools/github-cli/bin') + ';' + $env:PATH
$env:GH_CONFIG_DIR = Join-Path $PSScriptRoot '.deploy/github'
switch ($Action) {
  'dev' { & $nodePath scripts/dev-server.mjs }
  'test' { & $nodePath --test tests/rebuild.test.mjs tests/rebuild-domain.test.mjs tests/rebuild-release.test.mjs }
  'status' { & tools/git/cmd/git.exe status --short; & tools/github-cli/bin/gh.exe auth status }
  'login' { & tools/github-cli/bin/gh.exe auth login --hostname github.com --git-protocol https --web --scopes repo,workflow --skip-ssh-key }
  'publish-site' { & $nodePath scripts/build-cloudflare.mjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & $nodePath scripts/publish-cloudflare.mjs }
  'check-deploy' { & $nodePath --test tests/rebuild-release.test.mjs }
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
