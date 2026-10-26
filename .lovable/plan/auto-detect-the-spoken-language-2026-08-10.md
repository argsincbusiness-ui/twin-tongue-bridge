# Auto-detect the spoken language

Today each panel has a fixed language, so you must pick the right one before speaking. This adds an **Auto-detect** option to each panel's language picker: tap the mic, speak any language, and the app figures out what was said and translates it into the other panel's language (English by default).

## How it will work

- The language dropdown on each panel gets a new first entry: **Auto-detect (any language)**.
- Panel A defaults to Auto-detect, Panel B stays on a chosen output language (English by default).
- When a panel is set to Auto-detect:
  - Tapping the mic records the audio and transcribes it without a language hint, so any language is accepted.
  - The translator identifies the spoken language and translates into the other panel's language.
  - The panel header shows the detected language once it is known (e.g. "Auto-detect - Spanish"), so you can see what it heard.
- If a panel has a specific language selected, behaviour is unchanged.
- Everything else stays the same: preview delay, neural voice playback, replay, share, auto mode, admin, install.

## Trade-off to know about

Auto-detect can't use the browser's built-in live speech recognition (it requires a language up front), so an auto panel records the utterance and transcribes it after you stop. That means no live word-by-word "YOU SAID" text on the auto side, and a short pause (roughly a second) after speaking before the translation appears. Panels with a fixed language keep live streaming text.

## Technical details

- `src/lib/languages.ts`: add an `AUTO` sentinel language entry (`code: "auto"`) and helpers to test for it.
- `src/hooks/useSpeech.ts`: when `lang === "auto"`, skip the Web Speech path and always use the MediaRecorder + `/api/transcribe` path; omit the `language` form field so the model auto-detects. Existing TTS feedback guards stay intact.
- `src/routes/api/transcribe.ts`: no change needed (language is already optional).
- `src/lib/translate.functions.ts`: accept `sourceLang: "auto"`, adjust the system prompt to "detect the source language and translate into X", and extend the output schema with an optional `detectedLang` (language name) returned as strict JSON so the UI can label it. Output text itself remains translation-only.
- `src/routes/index.tsx`: default `langA` to `auto`; store `detectedLangA/B`; pass the detected name into history entries; resolve the TTS voice language for an auto panel from the other side's language (playback language is always the target, so unaffected).
- `src/components/SpeakerPanel.tsx`: render the detected language chip next to the picker; disable the swap button when a side is Auto-detect (nothing meaningful to swap into).
- Tests: extend `src/lib/translate.functions.test.ts` for the `auto` source value and the optional `detectedLang` field.
