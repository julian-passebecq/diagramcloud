$ErrorActionPreference = 'Stop'
$deckPath = (Resolve-Path -LiteralPath '.local/continuation/pptx-final/source.pptx').Path
$renderDir = Join-Path (Split-Path $deckPath) 'slides'
New-Item -ItemType Directory -Path $renderDir -Force | Out-Null
$beforeHash = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant()
$existingPowerPoint = @(Get-Process -Name POWERPNT -ErrorAction SilentlyContinue)
$powerPoint = $null
$presentation = $null
try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerPoint.Presentations.Open($deckPath, -1, 0, 0)
  $slideCount = $presentation.Slides.Count
  $powerPointVersion = $powerPoint.Version
  $presentation.Export($renderDir, 'PNG', 1600, 900)
  $presentation.Close()
  $presentation = $null
  $afterHash = (Get-FileHash -LiteralPath $deckPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($beforeHash -ne $afterHash) { throw 'PowerPoint source bytes changed' }
  $images = @(Get-ChildItem -LiteralPath $renderDir -Filter '*.PNG' -File | Sort-Object Name | ForEach-Object { [ordered]@{ name=$_.Name; bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() } })
  if ($images.Count -ne $slideCount) { throw 'Exported slide count mismatch' }
  [ordered]@{ sourceCommit='130c70744ec8fdeefebb784c56afb53c182f8dfa'; sourceSha256=$beforeHash; renderer='Microsoft PowerPoint COM read-only open, WithWindow=false, PNG export'; rendererVersion=$powerPointVersion; slideCount=$slideCount; exportedPngCount=$images.Count; dimensions='1600x900'; sourceUnchanged=$true; pngs=$images; limitation='Synthetic export; agent visual inspection only, not human owner acceptance' } | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath (Join-Path (Split-Path $deckPath) 'render-receipt.json')
  Get-Content -LiteralPath (Join-Path (Split-Path $deckPath) 'render-receipt.json')
} finally {
  if ($presentation) { $presentation.Close() }
  if ($powerPoint -and $existingPowerPoint.Count -eq 0 -and $powerPoint.Presentations.Count -eq 0) { $powerPoint.Quit() }
  if ($powerPoint) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint) }
}

