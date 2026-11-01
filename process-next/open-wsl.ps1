param(
  [Parameter(Mandatory=$true)][string]$Repo,
  [Parameter(Mandatory=$true)][string]$Request,
  [string]$Distribution = 'Ubuntu'
)
$ErrorActionPreference = 'Stop'
# User explicitly asked for a visible Ubuntu window with live progress.
# No shell-built command: terminal/wsl/node receive separate literal arguments.
$requestFile = (Resolve-Path -LiteralPath $Request).Path
$translatedRequest = & wsl.exe -d $Distribution --exec wslpath -u $requestFile.Replace('\', '/')
if ($LASTEXITCODE -ne 0 -or -not $translatedRequest) { throw 'Cannot translate request path into WSL' }
$linuxRequest = $translatedRequest.Trim()
$linuxRepo = $Repo
if (-not $Repo.StartsWith('/')) {
  $repoPath = (Resolve-Path -LiteralPath $Repo).Path
  $translatedRepo = & wsl.exe -d $Distribution --exec wslpath -u $repoPath.Replace('\', '/')
  if ($LASTEXITCODE -ne 0 -or -not $translatedRepo) { throw 'Cannot translate repository path into WSL' }
  $linuxRepo = $translatedRepo.Trim()
}
$terminal = Get-Command wt.exe -ErrorAction SilentlyContinue
if (-not $terminal) { throw 'Windows Terminal (wt.exe) is needed for the visible window' }
& $terminal.Source new-tab --title 'Houseplan · локальные проверки' wsl.exe -d $Distribution --cd $linuxRepo --exec node process-next/cli.mjs run --request $linuxRequest --keep-open
if ($LASTEXITCODE -ne 0) { throw 'Could not open the visible WSL run' }
