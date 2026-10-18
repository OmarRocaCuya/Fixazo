[CmdletBinding()]
param(
    [string]$Python = 'python'
)

$ErrorActionPreference = 'Stop'
$service = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $service '.venv-emotion'
$venvPython = Join-Path $venv 'Scripts\python.exe'

# Python 3.12 x64 has matching Windows CPU wheels for these exact Torch pins.
& $Python -c 'import struct,sys; sys.exit(0 if sys.version_info[:2] == (3,12) and struct.calcsize("P") == 8 else "Use Python 3.12 x64")'
if ($LASTEXITCODE -ne 0) { throw 'Use Python 3.12 x64 via -Python <path-to-python.exe>.' }
if (-not (Test-Path -LiteralPath $venvPython)) {
    & $Python -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated .venv-emotion environment.' }
}

& $venvPython -m pip install 'torch==2.8.0' 'torchaudio==2.8.0' --index-url 'https://download.pytorch.org/whl/cpu'
if ($LASTEXITCODE -ne 0) { throw 'Could not install the matching CPU Torch wheels.' }
& $venvPython -m pip install -r (Join-Path $PSScriptRoot 'requirements-emotion-local.txt')
if ($LASTEXITCODE -ne 0) { throw 'Could not install emotion-only requirements.' }
& $venvPython -m pip check
if ($LASTEXITCODE -ne 0) { throw 'The emotion environment has conflicting dependencies.' }
& $venvPython -B -c 'import numpy, torch, torchaudio; from funasr import AutoModel; print("Emotion-only imports OK; no model downloaded by setup")'
if ($LASTEXITCODE -ne 0) { throw 'The real emotion inference imports failed.' }
Write-Host 'Setup ready. Start-EmotionLocal.ps1 starts the pinned model only after explicit consent/license flags.'
