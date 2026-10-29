<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Public pages share `PublicWebsite`; the existing index interpreter remains at `/`, with `open` and `mode` search parameters for app entry so existing public URLs and conversation logic remain intact.
- Optional Live Interpreter uses the supported persistent relay and hook; authenticate `app.start` before Gateway connection, recheck Pro/admin and suspension server-side, and retain immediate media cleanup on Stop/unmount so live access cannot bypass existing plans.

- Studio-only additions live in isolated Studio modules; original-footage exports use browser media capture and clean up on unmount, preserving captioned exports and shared speech engines.
- Studio usage stores metadata only, with service-side inserts and admin-only RLS reads; episode production logs once after mixing rather than once per speech line.
- Podcast script writing uses a request-scoped streaming Responses SDK call and persists terminal access denials, preventing repeated blocked requests.
- All speech generation uses one global voice + style preference (src/lib/voice-styles.ts) and the shared VoiceSelector component; add a style by appending one entry to VOICE_STYLES only — never add a second voice/style control or a second TTS code path.
