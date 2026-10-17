@echo off
rem Jalankan skrip Node dengan runtime bawaan bila ada, jika tidak pakai node dari PATH.
rem Dipakai oleh [Run] dan pintasan installer supaya aplikasi tetap jalan di mesin
rem tanpa Node.js terpasang (ensure-node.ps1 menyediakan %~dp0runtime\node\node.exe).
setlocal
set "NODE=%~dp0runtime\node\node.exe"
if not exist "%NODE%" set "NODE=node"
"%NODE%" "%~dp0%~1"
exit /b %ERRORLEVEL%
