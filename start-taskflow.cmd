@echo off
title TaskFlow Launcher
netstat -an | findstr ":5432 .*LISTENING" >nul 2>&1 || explorer.exe "H:\Saas\.pg\start-pg.bat"
netstat -an | findstr ":3000 .*LISTENING" >nul 2>&1 || explorer.exe "H:\Saas\.pg\start-dev.bat"
echo.
echo TaskFlow: waiting for servers...
:wait
netstat -an | findstr ":5432 .*LISTENING" >nul 2>&1 || (timeout /t 2 /nobreak >nul & goto wait)
echo  Postgres  : OK  http://localhost:5432
:wait2
netstat -an | findstr ":3000 .*LISTENING" >nul 2>&1 || (timeout /t 2 /nobreak >nul & goto wait2)
echo  Dev server: OK  http://localhost:3000
start "" http://localhost:3000
echo.
echo All up. You may close this window - the servers keep running.
timeout /t 5 /nobreak >nul