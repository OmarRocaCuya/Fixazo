[CmdletBinding()]
param(
    [switch]$AdultDemoConsent,
    [switch]$AcceptModelLicense,
    [Security.SecureString]$AccessCode,
    [ValidateRange(1024, 65535)][int]$BackendPort = 8081,
    [ValidateRange(1024, 65535)][int]$WebPort = 3001,
    [ValidateRange(30, 3600)][int]$ReadyTimeoutSeconds = 900,
    [string]$SmokeAudio,
    [switch]$SmokeOnly,
    [switch]$NoWeb
)

$ErrorActionPreference = 'Stop'
if (-not $AdultDemoConsent -or -not $AcceptModelLicense) {
    throw 'Required: -AdultDemoConsent -AcceptModelLicense. Adult consenting voice only; read EMOTION_LOCAL.md first.'
}
$python = Join-Path (Split-Path -Parent $PSScriptRoot) '.venv-emotion\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Run Setup-EmotionLocal.ps1 with Python 3.12 x64 first.' }
if ($SmokeOnly -and -not $SmokeAudio) { throw '-SmokeOnly requires -SmokeAudio <adult-voice.wav>.' }

$previousCode = $env:VOICE_ACCESS_CODE
$pointer = [IntPtr]::Zero
try {
    if (-not $NoWeb) {
        if (-not $AccessCode -and -not $env:VOICE_ACCESS_CODE) {
            $AccessCode = Read-Host 'Adult demo access code (16-256 characters; use the same code in the UI)' -AsSecureString
        }
        if ($AccessCode) {
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AccessCode)
            $env:VOICE_ACCESS_CODE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        }
    }
    $runnerArgs = @('-B', (Join-Path $PSScriptRoot 'run_emotion_local.py'), '--adult-consent', '--accept-model-license', '--backend-port', $BackendPort, '--web-port', $WebPort, '--ready-timeout', $ReadyTimeoutSeconds)
    if ($SmokeAudio) { $runnerArgs += @('--smoke-audio', (Resolve-Path -LiteralPath $SmokeAudio).Path) }
    if ($SmokeOnly) { $runnerArgs += '--smoke-only' }
    if ($NoWeb) { $runnerArgs += '--no-web' }
    & $python @runnerArgs
    if ($LASTEXITCODE -ne 0) { throw 'Local emotion session failed. See the non-secret status/error above.' }
} finally {
    $env:VOICE_ACCESS_CODE = $previousCode
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
