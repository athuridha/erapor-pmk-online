@echo off
rem Pembungkus ensure-node.ps1 untuk [Run] installer.
rem Selalu keluar dengan kode 0: kegagalan menyiapkan runtime Node tidak boleh
rem menggagalkan instalasi. Mesin yang sudah punya Node.js di PATH dilewati
rem oleh ensure-node.ps1, dan run-node.cmd akan memakai node dari PATH itu.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ensure-node.ps1" -InstallDir "%~dp0.."
exit /b 0
