# Scratch voice-over (timing check only — a synthetic Windows system voice, NOT for publishing).
# Speaks each line of timeline.json → "voiceover" to review/voiceover-scratch/<id>.wav, so line lengths can be measured
# against their windows and a rough guide track can be assembled by source/scratch-voice.py.
#   powershell -NoProfile -ExecutionPolicy Bypass -File source/scratch-voice.ps1 [-Voice "Microsoft David Desktop"] [-Rate 1]
param([string]$Voice = "Microsoft David Desktop", [int]$Rate = 1)
Add-Type -AssemblyName System.Speech
$root = Split-Path -Parent $PSScriptRoot
$tl = Get-Content (Join-Path $root "timeline.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$out = Join-Path $root "review\voiceover-scratch"
New-Item -ItemType Directory -Force $out | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice($Voice)
$synth.Rate = $Rate
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($line in $tl.voiceover) {
    $file = Join-Path $out ($line.id + ".wav")
    $synth.SetOutputToWaveFile($file, $fmt)
    # "Odoo" and "Octagon9" spelled for the synthesizer
    $text = $line.text -replace "Odoo", "Oh-doo" -replace "Octagon9", "Octagon Nine"
    $synth.Speak($text)
    $synth.SetOutputToNull()
    Write-Output ("{0}  {1}" -f $line.id, $file)
}
$synth.Dispose()
