Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Launching Smart Interview Simulation Platform" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

# Fresh shared secret per launch: only the API gateway may submit code to the evaluator.
# Child windows started below inherit it from this process's environment.
$env:EVALUATOR_TOKEN = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))

# Rebuild the evaluator if its sources are newer than the binary
$exe = Join-Path $root 'evaluator-service\evaluator_service.exe'
$newestSrc = Get-ChildItem (Join-Path $root 'evaluator-service\src') -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not (Test-Path $exe) -or ($newestSrc -and $newestSrc.LastWriteTime -gt (Get-Item $exe).LastWriteTime)) {
    Write-Host "[0/4] Building C++ Code Evaluation Engine..." -ForegroundColor Yellow
    Push-Location (Join-Path $root 'evaluator-service')
    & g++ -std=c++20 -O2 src/main.cpp -lws2_32 -lpsapi -o evaluator_service.exe
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Host "Evaluator build failed." -ForegroundColor Red; exit 1 }
}

Write-Host "[1/4] Starting C++ Code Evaluation Engine (:8082)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\evaluator-service'; .\evaluator_service.exe 8082"

Start-Sleep -Seconds 1

Write-Host "[2/4] Starting Python NLP Feedback Engine (:8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\nlp-service'; python server.py"

Start-Sleep -Seconds 1

Write-Host "[3/4] Starting Node.js API Gateway (:5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; node src/server.js"

Start-Sleep -Seconds 1

Write-Host "[4/4] Starting React Frontend (:3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; node ./node_modules/vite/bin/vite.js"

Write-Host "========================================================" -ForegroundColor Green
Write-Host "  All 4 Platform Services Launched Successfully!" -ForegroundColor Green
Write-Host "  - Frontend:    http://localhost:3000" -ForegroundColor White
Write-Host "  - Node API:    http://localhost:5000" -ForegroundColor White
Write-Host "  - Swagger:     http://localhost:5000/api/docs" -ForegroundColor White
Write-Host "  - Python NLP:  http://localhost:8081/health" -ForegroundColor White
Write-Host "  - C++ Engine:  http://localhost:8082/health" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
