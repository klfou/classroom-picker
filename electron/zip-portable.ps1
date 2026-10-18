param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if ((Split-Path $Source -Leaf) -cne 'SunlitClassroom') { throw 'Unexpected portable directory name' }
if (Test-Path -LiteralPath $Destination) { throw 'Archive already exists; nothing was overwritten' }
# Construct POSIX entry names explicitly, independent of .NET compatibility
# switches that can otherwise emit backslashes on Windows PowerShell.
$root = [System.IO.Path]::GetFullPath($Source).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$zip = [System.IO.Compression.ZipFile]::Open($Destination, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in (Get-ChildItem -LiteralPath $Source -Recurse -File -Force | Sort-Object FullName)) {
    if (-not $file.FullName.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Portable file escapes output' }
    $name = 'SunlitClassroom/' + $file.FullName.Substring($root.Length).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $name, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }
$zip = [System.IO.Compression.ZipFile]::OpenRead($Destination)
try {
  $names = @($zip.Entries | ForEach-Object { $_.FullName })
  if ($names -cnotcontains 'SunlitClassroom/SunlitClassroom.exe') { throw 'ZIP is missing the portable executable' }
  if ($names -cnotcontains 'SunlitClassroom/resources/app.asar') { throw 'ZIP is missing the application ASAR' }
  foreach ($name in $names) {
    if (-not $name.StartsWith('SunlitClassroom/') -or $name.Contains('\') -or $name -match '(^|/)\.\.(/|$)' -or $name -match '(?i)(^|/)(Data|AppData|userData)(/|$)') { throw "Unexpected/private ZIP path: $name" }
  }
} finally { $zip.Dispose() }
