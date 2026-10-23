param(
    [string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
)
$ErrorActionPreference = 'Stop'
$reviewRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$reviewOut = Join-Path $PSScriptRoot 'expansion-review/screenshots'
$reviewProfile = Join-Path ([IO.Path]::GetTempPath()) ('achieve-introduction-preview-' + [Guid]::NewGuid().ToString('N'))
if (-not (Test-Path -LiteralPath $Chrome)) { throw 'Installed Chrome is required for optional screenshots.' }
New-Item -ItemType Directory -Force -Path $reviewOut | Out-Null
foreach ($reviewLang in @('de','hi','ta','uk','ja','ko')) {
    foreach ($reviewSize in @(@('desktop','1280,3200'),@('narrow','480,8000'))) {
        $reviewFile = Join-Path $reviewRoot "docs/$reviewLang/index.htm"
        if (-not (Test-Path -LiteralPath $reviewFile)) { throw "Missing page: $reviewLang" }
        $reviewPng = Join-Path $reviewOut "$reviewLang-$($reviewSize[0]).png"
        $reviewArgs = @('--headless','--no-first-run','--no-default-browser-check',
            "--user-data-dir=`"$reviewProfile`"", "--screenshot=`"$reviewPng`"",
            "--window-size=$($reviewSize[1])", ([Uri]$reviewFile).AbsoluteUri)
        $reviewProcess = Start-Process -FilePath $Chrome -ArgumentList $reviewArgs -WindowStyle Hidden -PassThru -Wait
        if ($reviewProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $reviewPng)) { throw "Screenshot failed: $reviewPng" }
        Write-Output $reviewPng
    }
}
