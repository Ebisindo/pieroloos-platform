$ErrorActionPreference = "Stop"

Write-Host "Generating authoritative npm package-lock.json..."
npm install --package-lock-only --ignore-scripts --no-audit --no-fund

if (!(Test-Path package-lock.json)) {
  throw "npm did not create package-lock.json"
}

Write-Host "Created package-lock.json successfully."
Write-Host ""
Write-Host "Next:"
Write-Host "  git add package.json package-lock.json"
Write-Host "  git commit -m 'fix: add authoritative npm lockfile'"
Write-Host "  git push"
