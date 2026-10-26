# Prepaid Credit Wallet (additive, Pro + EFT preserved)

## What was found
- Metered today (server-side, via `consume_usage`): text translation, photo translation, Learning Mode coach.
- **Not metered today, but costs money on the server:** AI song generation, server voice playback (`/api/tts`, Gemini then AI Gateway), speech-to-text for Dubbing/Studio Coach (`/api/transcribe`), Live Interpreter (Pro/admin gated only, no time metering).
- Conference room: Pro-only via database rules; its translations go through the same translate function, so they are already metered.
- Browser-only speech recognition / device voices: free, will stay free.

## Charging order (per action)
1. Pro or admin: unlimited, as today (no wallet use).
2. Free user: daily free allowance first (10 translations, 2 photos — unchanged).
3. Then wallet credits at the action's rate.
4. Otherwise blocked with a "Buy credits" button.
Actions with no free allowance (songs, Live Interpreter, Learning Mode for Free users) use credits only. Learning Mode and rooms stay Pro-only unless you choose otherwise (see Questions).

## Database (one additive migration, no drops)
- `credit_wallets` (user_id, balance >= 0 check, updated_at). Read own only; no client writes.
- `credit_ledger` (immutable: id, user_id, delta, balance_after, kind: grant/purchase/consume/reserve/refund/adjust, action, ref unique-per-kind for idempotency, reason, actor_id, created_at). Read own (admins all); no UPDATE/DELETE policies at all.
- `credit_reservations` (id, user_id, action, amount, status reserved/settled/refunded, expires_at) for long calls.
- `credit_packs` (name, credits, price, published default false) and `credit_rates` (action, credits, enabled). Admin-managed; signed-in users read published packs and rates.
- `payment_requests` gains `kind` ('subscription' default | 'credits') and `credit_pack_id`, `credits` — existing rows stay subscriptions.
- Seed: draft packs (e.g. 100 / 500 / 1500 credits) with **no price, unpublished**; rates seeded as placeholders, disabled where unknown.
- Functions (security definer, `FOR UPDATE` row lock on the wallet to stop double spending):
  - `charge_action(_action, _units)` — replaces `consume_usage` internally: allowance -> wallet -> block. Keeps `consume_usage` working.
  - `reserve_credits` / `settle_reservation` / `refund_reservation` (refund only once; stale reservations auto-refund).
  - `create_credit_topup(_pack_id)` — only published packs; amount taken from the pack, never the browser.
  - `review_payment` extended: credit top-ups grant credits once (ledger ref = payment id, unique), subscriptions unchanged.
  - `admin_adjust_credits(_user, _delta, _reason)` — reason required, audited, cannot go negative.
  - `wallet_status()` for the page; `admin_credit_stats()` for the dashboard.

## Server changes
- `enforceUsage` -> charge path; failed provider calls (Gemini/Gateway errors) refund the charge.
- Add charging to songs, `/api/tts` (server voice), `/api/transcribe`, and Live Interpreter (reserve per minute, settle actual seconds on stop, refund unused).
- Request size limits kept/added (10,000 chars text, photo size cap, audio length cap); per-user rate limit (e.g. max N billable calls/minute) inside the charge function; in-flight duplicate guard on the client.
- Provider failures logged with action and status.
- `src/lib/credits/` holds a gateway-agnostic `confirmTopup(paymentId)` server helper so a future Yoco webhook can call the same idempotent grant. No webhook is added now.

## Screens
- New **Credits & Usage** page (from Account and the plan bar): balance, today's free allowance, costs per action, history, packs (shown "Coming soon" while unpublished), top-up via existing EFT page showing "Pending confirmation".
- Plan bar: low-credit warning; blocked state with "Buy credits".
- Admin: Credits tab — packs (draft/publish), rates, top-up approvals (in the existing payments list, labelled), user adjustments with reason, usage/cost dashboard.

## Tests
Pure charge-decision logic in `src/lib/credits/` with tests for: allowance-then-wallet order, insufficient balance blocks, refund on failure, approval idempotency (same ref twice grants once), Pro/admin unchanged, Free limits unchanged. Plus live SQL checks against the database for row locking and user isolation (read-only checks on test accounts only — no real credits granted).

## Not done without your confirmation
- No prices published, no live payment, no production settings changed, no real credits granted.
- Yoco automation stays blocked until `YOCO_SECRET_KEY` and a webhook signing secret exist.

## Questions (defaults used if you approve as-is)
1. Should Free users be able to use Learning Mode and rooms by paying credits? Default: no, stay Pro-only.
2. Should server voice playback (TTS) and speech-to-text cost credits for Free users? Default: yes, small rate, with a free daily allowance of 20 plays.
3. Should Pro users ever spend credits (e.g. on songs, which are costly)? Default: no, Pro stays unlimited.
