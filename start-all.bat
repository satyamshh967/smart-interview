@echo off
setlocal
echo ========================================================
echo   Launching Smart Interview Simulation Platform
echo ========================================================

set "PROJECT_DIR=%~dp0"

rem Fresh shared secret per launch: only the API gateway may submit code to the evaluator.
rem Windows opened with "start" inherit it from this environment.
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))"`) do set "EVALUATOR_TOKEN=%%T"

if not exist "%PROJECT_DIR%evaluator-service\evaluator_service.exe" (
    echo [0/4] Building C++ Code Evaluation Engine...
    pushd "%PROJECT_DIR%evaluator-service"
    call build.bat
    popd
)

echo [1/4] Starting C++ Code Evaluation Engine (:8082)...
start "C++ Evaluator Service" cmd /k "cd /d "%PROJECT_DIR%evaluator-service" && evaluator_service.exe"

timeout /t 1 /nobreak >nul

echo [2/4] Starting Python NLP Feedback Engine (:8081)...
start "Python NLP Service" cmd /k "cd /d "%PROJECT_DIR%nlp-service" && python server.py"

timeout /t 1 /nobreak >nul

echo [3/4] Starting Node.js API Gateway (:5000)...
start "Node Gateway" cmd /k "cd /d "%PROJECT_DIR%backend" && node src/server.js"

timeout /t 1 /nobreak >nul

echo [4/4] Starting React Frontend (:3000)...
start "React Frontend" cmd /k "cd /d "%PROJECT_DIR%frontend" && node ./node_modules/vite/bin/vite.js"

echo ========================================================
echo   All 4 Platform Services Launched Successfully!
echo   - Frontend:    http://localhost:3000
echo   - Node API:    http://localhost:5000
echo   - Swagger Docs:http://localhost:5000/api/docs
echo   - Python NLP:  http://localhost:8081/health
echo   - C++ Engine:  http://localhost:8082/health
echo ========================================================
