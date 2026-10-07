# Voice-over — script, timing, and how to add it

The film works without a voice: every beat is carried by an on-screen line, because store listings and social feeds mostly autoplay muted. A voice-over is an upgrade for places where sound is on (YouTube, the website, sales calls), not a requirement.

## Script

76 words, a calm pace (about 2.7 words per second), with room between lines. Times are from `timeline.json` → `voiceover`.

| # | Starts | Must end by | Line | On screen at that moment |
|---|---|---|---|---|
| 1 | 0.30 s | 3.30 s | Meet Shadow: your Odoo, in your employees' hands. | The phone wakes; "Your Odoo. In their hands." |
| 2 | 3.40 s | 8.90 s | It works with the Odoo you already run: versions fifteen to nineteen, no module to install. | Versions 15–19 light up on the portal |
| 3 | 9.43 s | 16.50 s | Six everyday apps, one place: time off, expenses, attendance, timesheets, helpdesk and maintenance. | The six cards scroll past, in this order |
| 4 | 16.80 s | 20.40 s | Here's an example. An employee requests time off. | The form, the Submit tap, "submitted" |
| 5 | 21.30 s | 25.67 s | It lands in Odoo as a real record, and the manager approves it there. | The Odoo record goes from To Approve to Approved |
| 6 | 26.30 s | 30.00 s | The employee gets the answer, right on their phone. | The approval arrives in the Inbox |
| 7 | 31.50 s | 36.33 s | Shadow, by Octagon9. Your Odoo, in every pocket. | The logo and tagline |

## Direction for the voice

- **Tone:** warm, clear, unhurried. A colleague explaining, not an advert.
- **Pronunciation:** "Odoo" is *oh-doo*. "Octagon9" is *Octagon Nine*.
- **Line 3:** read as a list, with a light lift on each item; the cards pass in the same order.
- **Line 5:** a small beat before "and the manager approves it there". The click happens at 23.8 s.

## Ways to produce it

| Option | What you get | Cost | Notes |
|---|---|---|---|
| A voice artist | The best result, and a real person on record for licensing | Varies by artist | Send them this file and `out/audio/shadow-explainer-mix-vo-bed.wav` to read against |
| An AI voice | Fast, and easy to redo if the script changes | Varies by service | The media tool connected to this workspace is on a free plan with 0 credits, so it needs a purchase first. Check the service's licence covers commercial use |
| No voice | Ready today | Nothing | The delivered film |

The scratch track in `review/voiceover-scratch/` is a Windows system voice. It exists only to prove that each line fits its window. Don't publish it.

## The voice in the delivered film

`out/shadow-by-octagon9-explainer-9x16-with-voice.mp4` uses ElevenLabs: the default voice **Bella** on the Multilingual v2 model, generated on a paid plan (ElevenLabs allows commercial use only on paid plans).

One spelling is deliberate. For this voice, "Odoo" is typed **"Oh-dwoo"** in lines 1, 2, 5 and 7. Typed normally, Bella says "OH-dew"; the client heard that on 7 Oct 2026 and rejected it, then chose the "Oh-dwoo" reading by ear from four samples (kept in `review/odoo-pronunciation/`). Other spellings, the v4 model with phonetic input and the other default voices tried all kept the "ew". If a line is ever regenerated, keep that spelling.

Line 2 is sped up by 4 % and two lines have their pauses shortened by about a tenth of a second so they end before the next picture change; `out/voice/bella/fit-report.json` lists every line.

## Adding a recorded voice

Deliver the voice as one WAV that starts at the film's first frame (silence where nobody speaks), any sample rate, mono or stereo. Then:

```bash
python source/soundtrack.py --vo path/to/voice.wav
node source/render.mjs --encode-only --audio out/audio/shadow-explainer-mix-with-vo.wav --name shadow-by-octagon9-explainer-9x16-with-vo
```

The first command levels the voice to about −16 LUFS, ducks the music 12 dB under each line, and masters the result to −14 LUFS with true peak under −1 dBTP. The second re-uses the rendered picture and takes under a minute.

If the voice comes as one file per line instead (which is how AI takes arrive), put them in one folder named `vo1-t1.mp3`, `vo1-t2.mp3`, `vo2-t1.mp3` and so on, and run this first. It picks a take per line, fits it to the picture and writes the single aligned file:

```bash
python source/voice-assemble.py out/voice/bella
```

If a line is re-timed, change its `start` and `end` (in frames, 60 per second) in `timeline.json` → `voiceover`; the ducking follows.

## Other languages

The app ships in English and Arabic. An Arabic or French version needs the seven lines translated, a new voice take, and the on-screen lines in `timeline.json` → `copy` translated; Arabic also needs the headlines right-aligned. That is a separate cut, not a setting.
