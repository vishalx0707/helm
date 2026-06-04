# make-shortcuts.ps1 — create Desktop + Start-menu shortcuts to the built exe.
# A portable .exe does NOT self-install, so nothing shows in Start by default;
# this places real .lnk shortcuts (with the HELM icon) in both places.
# Run after `pnpm dist`:  pnpm run shortcuts
#
# Targets the UNPACKED exe (release\win-unpacked\HELM.exe) by preference: it
# launches instantly with no self-extraction step, so it's far more reliable to
# double-click than the portable stub (which re-extracts 70+ MB to %TEMP% every
# launch and can race with antivirus / leftover temp dirs). Falls back to the
# portable single-file exe if the unpacked build isn't present.
$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$pkg     = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version
$icon    = Join-Path $root 'assets\icon.ico'

$unpacked = Join-Path $root 'release\win-unpacked\HELM.exe'
$portable = Join-Path $root "release\HELM-$version-portable.exe"
if     (Test-Path $unpacked) { $exe = $unpacked }
elseif (Test-Path $portable) { $exe = $portable }
else {
  Write-Warning "Built exe not found (looked for win-unpacked and portable)."
  Write-Warning "Run 'pnpm dist' first, then re-run 'pnpm run shortcuts'."
  exit 1
}
Write-Host "Target exe: $exe"

$desktop   = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
$targets   = @(
  (Join-Path $desktop   'HELM.lnk'),
  (Join-Path $startMenu 'HELM.lnk')
)

$wsh = New-Object -ComObject WScript.Shell
foreach ($lnkPath in $targets) {
  $lnk = $wsh.CreateShortcut($lnkPath)
  $lnk.TargetPath       = $exe
  $lnk.WorkingDirectory = Split-Path -Parent $exe
  $lnk.IconLocation     = $icon
  $lnk.Description       = 'HELM — mobile control interface host'
  $lnk.Save()
  Write-Host "Created: $lnkPath"
}
Write-Host "Done. 'HELM' should now appear in Start menu search and on the Desktop."
