# Synthesize each item of a JSON array [{path,text}] to a WAV with the Windows built-in speech engine.
param([string]$Json, [string]$Voice = "Microsoft Zira", [int]$Rate = 0)
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice($Voice)
$s.Rate = $Rate
foreach ($i in $items) {
  $s.SetOutputToWaveFile($i.path)
  $s.Speak($i.text)
}
$s.SetOutputToNull()
$s.Dispose()
