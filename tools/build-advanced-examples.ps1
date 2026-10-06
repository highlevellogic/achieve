param(
    [string]$ExamplesRepository = (Join-Path (Split-Path -Parent $PSScriptRoot) "..\achieve_examples")
)

$ErrorActionPreference = "Stop"

$achieveRepository = Split-Path -Parent $PSScriptRoot
$templateDirectory = Join-Path $achieveRepository "distribution\advanced-examples"
$outputDirectory = Join-Path $achieveRepository "docs\downloads"
$archivePath = Join-Path $outputDirectory "achieve-v3-advanced-examples-dev.zip"
$buildRoot = Join-Path $env:TEMP ("achieve-v3-advanced-examples-build-" + [Guid]::NewGuid())
$distributionRoot = Join-Path $buildRoot "achieve3-examples"

if (-not (Test-Path -LiteralPath $ExamplesRepository -PathType Container)) {
    throw "Examples repository not found: $ExamplesRepository"
}

New-Item -ItemType Directory -Path $distributionRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $distributionRoot "application\images") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $distributionRoot "application\confirm\servlets") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $distributionRoot "application\advanced") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $distributionRoot "vendor\achieve") | Out-Null
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

Get-ChildItem -LiteralPath $templateDirectory -File |
    Where-Object Name -NotIn @("application-index.htm","hello.jss") |
    Copy-Item -Destination $distributionRoot

Copy-Item -LiteralPath (Join-Path $templateDirectory "application-index.htm") `
    -Destination (Join-Path $distributionRoot "application\index.htm")
Copy-Item -LiteralPath (Join-Path $templateDirectory "hello.jss") `
    -Destination (Join-Path $distributionRoot "application\confirm\servlets\hello.jss")
Copy-Item -LiteralPath (Join-Path $ExamplesRepository "images\skyhigh1.jpg") `
    -Destination (Join-Path $distributionRoot "application\images\skyhigh1.jpg")
Copy-Item -LiteralPath (Join-Path $ExamplesRepository "advanced\index.htm") `
    -Destination (Join-Path $distributionRoot "application\advanced\index.htm")

foreach ($name in @("mysql","websockets","cluster","xml","distributed","soap")) {
    Copy-Item -LiteralPath (Join-Path $ExamplesRepository "advanced\$name") `
        -Destination (Join-Path $distributionRoot "application\advanced") -Recurse
}

foreach ($relativePath in @(
    "application\advanced\websockets\achieve_rooms.js",
    "application\advanced\cluster\cluster_node.mjs",
    "application\advanced\cluster\hello.txt",
    "application\advanced\cluster\node_start.mjs",
    "application\advanced\cluster\test1_8989.js",
    "application\advanced\xml\basic.js",
    "application\advanced\xml\js",
    "application\advanced\soap\js",
    "application\advanced\soap\soap.txt"
)) {
    $target = Join-Path $distributionRoot $relativePath
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}

foreach ($name in @("achieve.js","package.json","CHANGELOG.md","LICENSE")) {
    Copy-Item -LiteralPath (Join-Path $achieveRepository $name) `
        -Destination (Join-Path $distributionRoot "vendor\achieve\$name")
}

$forbidden = Select-String -Path (Get-ChildItem -LiteralPath $distributionRoot -File -Recurse).FullName `
    -Pattern "C:\\projects\\achieve","C:/projects/achieve","..\\achieve_examples" -SimpleMatch
if ($forbidden) {
    $forbidden | Format-Table Path,LineNumber,Line -AutoSize
    throw "The assembled distribution contains a development-repository path."
}

if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression
$archive = [System.IO.Compression.ZipFile]::Open(
    $archivePath,
    [System.IO.Compression.ZipArchiveMode]::Create
)
try {
    $basePath = Split-Path -Parent $distributionRoot
    Get-ChildItem -LiteralPath $distributionRoot -File -Recurse |
        Sort-Object FullName |
        ForEach-Object {
            $entryName = $_.FullName.Substring($basePath.Length + 1).Replace("\","/")
            $entry = $archive.CreateEntry(
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            )
            $entry.LastWriteTime = [DateTimeOffset]::new(2000,1,1,0,0,0,[TimeSpan]::Zero)
            $input = [System.IO.File]::OpenRead($_.FullName)
            $output = $entry.Open()
            try { $input.CopyTo($output) }
            finally {
                $output.Dispose()
                $input.Dispose()
            }
        }
} finally {
    $archive.Dispose()
}

Write-Output $archivePath
Remove-Item -LiteralPath $buildRoot -Recurse -Force
