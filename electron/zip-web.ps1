param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination, [Parameter(Mandatory=$true)][string]$Manifest)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $Destination) { throw 'Archive already exists; nothing was overwritten' }
$files = @((Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json).webFiles)
$seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
$root = [System.IO.Path]::GetFullPath($Source).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$zip = [System.IO.Compression.ZipFile]::Open($Destination, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $name = [string]$file.path
    if (-not $seen.Add($name) -or $name -match '(^/|\\|:|(^|/)\.{1,2}(/|$)|(^|/)\.|(?i)(^|/)(Data|AppData|userData)(/|$))') { throw "Unsafe web path: $name" }
    $input = [System.IO.Path]::GetFullPath((Join-Path $Source $name))
    if (-not $input.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Web source escapes output' }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $input, $name, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }
$zip = [System.IO.Compression.ZipFile]::OpenRead($Destination)
try {
  if ($zip.Entries.Count -ne $files.Count) { throw 'Web ZIP file count differs' }
  foreach ($file in $files) {
    $entry = $zip.GetEntry($file.path)
    if ($null -eq $entry -or $entry.Length -ne $file.size) { throw 'Web ZIP size/path differs' }
    $stream = $entry.Open(); $hash = [System.Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hash.Dispose() }
    if ($actual -cne $file.sha256) { throw "Web ZIP bytes differ: $($file.path)" }
  }
} finally { $zip.Dispose() }
