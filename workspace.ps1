param([ValidateSet('dev','test','status','login','publish-site','check-deploy')][string]$Action = 'dev')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodePath = Get-ChildItem -LiteralPath '.tools/node' -Filter node.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (!$nodePath) { throw 'Local Node.js is missing.' }
$env:PATH = (Split-Path $nodePath) + ';' + (Join-Path $PSScriptRoot 'tools/git/cmd') + ';' + (Join-Path $PSScriptRoot 'tools/github-cli/bin') + ';' + $env:PATH
$env:GH_CONFIG_DIR = Join-Path $PSScriptRoot '.deploy/github'
switch ($Action) {
  'dev' { & $nodePath scripts/dev-server.mjs }
  'test' { & $nodePath tests/run.mjs }
  'status' { & tools/git/cmd/git.exe status --short; & tools/github-cli/bin/gh.exe auth status }
  'login' { & tools/github-cli/bin/gh.exe auth login --hostname github.com --git-protocol https --web --scopes repo,workflow --skip-ssh-key }
  'publish-site' { & $nodePath scripts/publish-site.mjs }
  'check-deploy' { & $nodePath scripts/deploy.mjs --check }
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
