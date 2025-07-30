@echo off

@REM npm cache clean --force
@REM rmdir /s /q node_modules
@REM del package-lock.json

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
cd /d C:\dev\ai\cc-copilot.com
@REM node-gyp configure
npm install
