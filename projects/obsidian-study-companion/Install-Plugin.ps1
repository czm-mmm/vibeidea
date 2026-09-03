param([Parameter(Mandatory = $true)][string]$VaultPath)
$ErrorActionPreference = 'Stop'
$vaultDirectory = (Resolve-Path -LiteralPath $VaultPath).Path
if (-not (Test-Path -LiteralPath $vaultDirectory -PathType Container)) { throw 'Vault 路径不是文件夹。' }
$configDirectory = Join-Path $vaultDirectory '.obsidian'
if (-not (Test-Path -LiteralPath $configDirectory -PathType Container)) { throw '请先在 Obsidian 打开这个文件夹，使其成为 Vault，然后再安装。' }
$sourceDirectory = Join-Path $PSScriptRoot 'dist\study-companion'
$targetDirectory = [IO.Path]::GetFullPath((Join-Path $configDirectory 'plugins\study-companion'))
$expectedParent = [IO.Path]::GetFullPath((Join-Path $configDirectory 'plugins'))
if ([IO.Path]::GetDirectoryName($targetDirectory) -ne $expectedParent) { throw '插件目标路径不在预期目录内。' }
$files = @('main.js', 'manifest.json', 'styles.css')
foreach ($name in $files) { if (-not (Test-Path -LiteralPath (Join-Path $sourceDirectory $name) -PathType Leaf)) { throw "缺少构建文件：$name" } }
if (Test-Path -LiteralPath $targetDirectory) {
  $backupDirectory = Join-Path $configDirectory ('study-companion-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6))
  New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
  foreach ($name in $files) { $existingFile = Join-Path $targetDirectory $name; if (Test-Path -LiteralPath $existingFile -PathType Leaf) { Copy-Item -LiteralPath $existingFile -Destination (Join-Path $backupDirectory $name) } }
  Write-Output "原插件文件备份在：$backupDirectory"
}
New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $sourceDirectory $name) -Destination (Join-Path $targetDirectory $name) -Force }
Write-Output "已复制插件至：$targetDirectory"
Write-Output '请在 Obsidian 的第三方插件中启用 学习 · Study Companion。已有启用版本请重新加载。'
