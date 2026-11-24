# Twin Tongue Bridge — ChatGPT App Submission Pack

**Publisher:** ARGS INC Business  
**Creator:** Gerswille Davids  
**Support:** Gerswilledavids@gmail.com  
**Website:** https://twin-tongue-bridge.vercel.app  
**MCP endpoint:** https://twin-tongue-bridge.vercel.app/mcp  
**Repository:** https://github.com/argsincbusiness-ui/twin-tongue-bridge  
**MCP server version in source:** 1.1.0

> Submission status: preparation material only. The cases below are a test plan, not evidence that the tests have been executed or passed. Record actual outcomes and attach a real demo recording before submitting.

## App description

Twin Tongue Bridge is a multilingual communication app. Its website provides translation and communication workflows including Duplex Talk, Face-to-Face, Photo Translation, Conference Rooms, Learning Mode, Sing It, and Studio. Its MCP server exposes app discovery/opening tools and a `translate_text` tool that uses the app's existing translation providers and account usage enforcement.

## Reviewer access

- Reviewer account email: `Argsincbusiness@gmail.com`
- Sign-in method: password-based, per publisher confirmation
- Sign-in URL: https://twin-tongue-bridge.vercel.app
- Password: enter privately in the submission portal's reviewer-access field; do not store it in this repository or this document.
- Reviewer should sign in with the dedicated reviewer account, then use the app's translation workflow and the MCP `translate_text` tool.
- Do not use a personal administrator account for review.

## Positive test plan (5)

Run each case using the published production endpoint and record date, client, input, observed output, and pass/fail. Use the dedicated reviewer account where authentication is required.

| ID | Scenario | Steps / sample input | Expected result |
|---|---|---|---|
| P1 | App discovery | Call `get_app_overview`. | Returns a concise app description, the published website URL, and the available workflow names. |
| P2 | Open the app | Call `open_twin_tongue_bridge`. | Returns the production website URL; opening it loads the Twin Tongue Bridge site. |
| P3 | Basic translation | As the reviewer account, call `translate_text` with text `Good morning. How are you today?`, source language `English`, target language `isiZulu`. | Returns a non-empty isiZulu translation and completes without an authentication or provider error. |
| P4 | Automatic source detection | As the reviewer account, submit a short, unambiguous sentence in a supported source language with source language set to auto-detect and a different target language. | Detects the source language and returns a translation in the requested target language. |
| P5 | Translation style | As the reviewer account, submit a short sentence with an explicitly selected supported style (for example, formal) and a target language. | Returns a translation in the requested target language and applies the selected style where supported. |

## Negative and safety test plan (3)

| ID | Scenario | Steps / sample input | Expected result |
|---|---|---|---|
| N1 | Unauthenticated translation | Call `translate_text` without a valid Supabase access token. | Request is rejected; no translation is returned. Authentication challenge/error is returned without exposing secrets. |
| N2 | Empty input validation | As an authenticated reviewer, call `translate_text` with empty or whitespace-only text. | Request is rejected with a clear validation error; no provider call or billable translation should be performed. Verify actual implementation behavior before marking passed. |
| N3 | Usage restriction | Use a controlled test account that has reached its applicable daily translation allowance or is suspended, then call `translate_text`. | Existing account usage/suspension enforcement prevents unauthorized additional translation and does not bypass the app's plan rules. Do not exhaust a real customer's quota; use a controlled test account or approved test fixture. |

## Evidence checklist

- [ ] Execute P1–P5 against production and record actual results.
- [ ] Execute N1–N3 using controlled test conditions and record actual results.
- [ ] Capture a screen recording of the real app and MCP workflow; do not simulate results or edit out errors.
- [ ] Show reviewer sign-in without displaying the password, then show one successful translation.
- [ ] Confirm the public website, privacy notice, support contact, and any required terms page are reachable.
- [ ] Verify the app domain in the developer submission portal if requested.
- [ ] Enter reviewer credentials only in the portal's private reviewer-access field.
- [ ] Review the final tool descriptions, permissions, and safety behavior before submission.

## Suggested demo recording (about 2 minutes)

1. Show the Twin Tongue Bridge landing page at https://twin-tongue-bridge.vercel.app.
2. Briefly introduce the app and show its real available workflows.
3. Sign in using the dedicated reviewer account. Keep the password and account recovery information off-screen.
4. Open the translation workflow and translate: “Good morning. How are you today?” from English to isiZulu.
5. Show the returned translation and explain that the MCP `translate_text` tool uses the same app translation providers and account usage enforcement.
6. Show the MCP client calling `get_app_overview` and `translate_text`, if the recording setup supports it.
7. End by showing the website and support contact.

## Release notes — 1.1.0

- Exposes Twin Tongue Bridge app discovery through the MCP `get_app_overview` tool.
- Provides an MCP action to open the production Twin Tongue Bridge website.
- Adds authenticated `translate_text` access through the existing translation providers.
- Applies the app's existing account usage enforcement to MCP translation requests.
- Verifies Supabase access tokens before protected MCP methods are served.

## Important submission notes

- This pack does not claim that the positive or negative tests have passed. Populate the evidence checklist only after executing them.
- The reviewer email and password-based access arrangement were supplied by the publisher. The password itself must be provided privately through the official submission portal.
- Public directory publication, review approval, and recommendations by ChatGPT are decisions made by OpenAI and are not guaranteed by this document.
