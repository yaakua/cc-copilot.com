@echo off
REM Setup script for Claude configuration on Windows
REM This script helps set the CLAUDE_CONFIG_PATH environment variable

echo Setting up Claude configuration path...

REM Default paths to check
set DEFAULT_PATHS=%USERPROFILE%\.claude\settings.json;%APPDATA%\.claude\settings.json;%LOCALAPPDATA%\.claude\settings.json

echo Checking for existing Claude configuration files...

for %%p in (%DEFAULT_PATHS%) do (
    if exist "%%p" (
        echo Found Claude config at: %%p
        set CLAUDE_CONFIG_PATH=%%p
        goto :found
    )
)

echo No Claude configuration found in default locations.
echo Please specify the path to your Claude settings.json file:
set /p CLAUDE_CONFIG_PATH="Enter path to Claude settings.json: "

:found
if exist "%CLAUDE_CONFIG_PATH%" (
    echo Setting CLAUDE_CONFIG_PATH environment variable...
    setx CLAUDE_CONFIG_PATH "%CLAUDE_CONFIG_PATH%"
    echo Configuration path set to: %CLAUDE_CONFIG_PATH%
    echo Please restart the application for changes to take effect.
) else (
    echo Error: Configuration file not found at %CLAUDE_CONFIG_PATH%
    pause
)

pause