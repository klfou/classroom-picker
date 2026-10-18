param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if ((Split-Path $Source -Leaf) -cne 'SunlitClassroom') { throw 'Unexpected portable directory name' }
if (Test-Path -LiteralPath $Destination) { throw 'Archive already exists; nothing was overwritten' }
[System.IO.Compression.ZipFile]::CreateFromDirectory($Source, $Destination, [System.IO.Compression.CompressionLevel]::Optimal, $true)
$zip = [System.IO.Compression.ZipFile]::OpenRead($Destination)
try {
  $names = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
  if ($names -cnotcontains 'SunlitClassroom/SunlitClassroom.exe') { throw 'ZIP is missing the portable executable' }
  if ($names -cnotcontains 'SunlitClassroom/resources/app.asar') { throw 'ZIP is missing the application ASAR' }
  foreach ($name in $names) {
    if (-not $name.StartsWith('SunlitClassroom/') -or $name -match '(^|/)\.\.(/|$)' -or $name -match '(?i)(^|/)(Data|AppData|userData)(/|$)') { throw "Unexpected/private ZIP path: $name" }
  }
} finally { $zip.Dispose() }
