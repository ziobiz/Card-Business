# Wirex Card - 개발 서버 동시 실행
# usage: .\scripts\start-dev.ps1

$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\backend'; npm run dev" -PassThru
Start-Sleep -Seconds 3
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\frontend'; npm run dev" -PassThru
Write-Host "Backend: http://localhost:3001"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Press Ctrl+C to stop"
