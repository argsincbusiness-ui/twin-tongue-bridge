# Neural Duplex Lite - Agency Studio

NEURAL DUPLEX AI LITE



MASTER BLUEPRINT FOR MEDO.DEV



---



SYSTEM ROLE



You are an Elite Software Architect, Senior AI Engineer, Senior UX Designer, Full-Stack Engineer, Mobile Engineer, Security Engineer, and DevOps Engineer.



Your task is to design and build a complete production-quality AI Translator application called:



NEURAL DUPLEX AI LITE



The application must be clean, modern, scalable, mobile-first, and designed for tablets and smartphones.



This is not a chatbot.



This is a real-time AI Interpreter that allows two people speaking different languages to communicate naturally.



---



PRIMARY OBJECTIVE



Create a two-person AI interpreter that enables face-to-face conversations.



The system must automatically:



- Listen

- Detect language

- Convert speech into text

- Understand context

- Translate intelligently

- Speak the translated message naturally

- Continue the conversation without unnecessary taps



---



CORE TRANSLATION PIPELINE



Person A Speaks



↓



Automatic Voice Detection



↓



Automatic Language Detection



↓



Built-in Device Speech-to-Text



↓



AI Understanding



↓



Context Memory



↓



Translation



↓



Grammar Correction



↓



Built-in Device Text-to-Speech



↓



Person B Hears Translation



↓



Person B Speaks



↓



Repeat Automatically



---



IMPORTANT REQUIREMENT



DO NOT use browser SpeechRecognition as the primary solution.



Instead use the native device speech services whenever available.



Android



SpeechRecognizer



TextToSpeech



iOS



Speech Framework



AVSpeechSynthesizer



If the app runs as a PWA where native APIs are unavailable, use the browser Web Speech API as a fallback.



---



AI ENGINE



Use an LLM for reasoning.



Responsibilities



Understand context



Detect intent



Correct recognition mistakes



Maintain conversation memory



Translate naturally



Preserve names



Preserve addresses



Preserve numbers



Preserve dates



Preserve business terminology



Never translate literally.



Translate like a professional human interpreter.



---



AUTOMATIC LANGUAGE DETECTION



Every time someone speaks:



Detect the spoken language automatically.



Display



Detected Language



Confidence Score



Example



English



98%



If confidence is low



Ask user



or



Use previous language.



Allow manual override.



---



FACE TO FACE MODE



Split screen.



Top half



User A



Bottom half



User B



Each side includes



Language



Microphone



Live Transcript



Translation



Replay Button



Status



Large readable fonts



Touch friendly controls



Rotate the opposite side for table conversations.



---



CONVERSATION MODE



Only one microphone listens at a time.



When Person A finishes



Automatically



Translate



Speak



Switch listening



Repeat forever



No manual switching.



---



TEXT TO SPEECH



Use built-in operating system voices.



Automatically choose the correct voice for the language.



Examples



Zulu voice



French voice



German voice



Japanese voice



English voice



Allow



Voice Speed



Pitch



Volume



Replay Translation



Mute



---



SPEECH TO TEXT



Use native recognition.



Support punctuation.



Support long sentences.



Handle noisy environments.



Automatically stop after silence.



---



AI MEMORY



Remember the last 20 conversation exchanges.



Understand



he



she



they



there



that



previous subjects



Keep terminology consistent.



---



CONVERSATION HISTORY



Save



Original Text



Translated Text



Detected Language



Target Language



Speaker



Timestamp



Allow



Search



Delete



Export



TXT



PDF



DOCX



CSV



---



TRANSLATION MODES



General



Business



Medical



Legal



Education



Travel



Logistics



Fleet



Technical



Each mode changes the AI prompt to use the appropriate terminology.



---



SETTINGS



Theme



Dark



Light



System



Language



Speech Speed



Speech Pitch



Voice Selection



Translation Mode



Auto Detect Language



Microphone Sensitivity



Silence Timeout



Offline Mode



---



MASTER ADMINISTRATOR



Create a secure Super Administrator role.



The Super Administrator must have complete access to:



Users



Sessions



Translations



Prompt templates



AI provider configuration



Application settings



Languages



Voice configuration



Usage statistics



Analytics



Export logs



System diagnostics



Error monitoring



Health dashboard



The initial Super Administrator account must be created securely during application setup (never hard-coded).



---



SECURITY



Never expose AI API keys.



Use backend proxy.



JWT authentication.



HTTPS only.



Rate limiting.



Encrypted communication.



Secure storage.



Error logging.



Automatic retry.



Graceful failure.



---



USER EXPERIENCE



One tap to start.



Automatic listening.



Automatic translation.



Automatic speech playback.



Large controls.



Accessible interface.



Fast startup.



Minimal latency.



Responsive on phones and tablets.



---



PERFORMANCE



Target



Speech Recognition



<500 ms after speech ends



Translation



1–3 seconds (network dependent)



Speech Playback



Starts immediately after translation



Smooth UI



60 FPS animations where practical



---



ERROR HANDLING



Handle



No microphone permission



Network unavailable



Speech not recognized



AI timeout



Translation failure



Voice unavailable



Display friendly error messages.



Allow retry.



Never crash.



---



TESTING REQUIREMENTS



Generate



Unit tests



Integration tests



API tests



UI tests



Accessibility checks



Type checking



Linting



Build validation



The generated project must build without TypeScript errors and include clear error handling and logging. (No software can guarantee zero bugs, but the project should be engineered to minimize defects.)



---



TECHNOLOGY STACK



Frontend



Next.js 15



React



TypeScript



Tailwind CSS



PWA



Backend



Node.js



Express



Prisma



PostgreSQL



AI



OpenAI Responses API or Realtime API



Optional Claude Sonnet reasoning layer



Authentication



JWT



Deployment



Docker



Environment variables



---



PROJECT STRUCTURE



/apps

/web

/components

/features

/translator

/audio

/languages

/hooks

/lib

/server

/prisma

/public

/tests

/docs



---



FINAL DELIVERABLE



Generate a complete, clean, maintainable application with:



• Mobile-first responsive UI

• Face-to-face translator mode

• Automatic language detection

• Native Speech-to-Text integration (with browser fallback)

• Native Text-to-Speech integration (with browser fallback)

• AI-powered contextual translation

• Conversation memory

• Conversation history

• Transcript export

• Settings panel

• Secure Super Administrator role

• Backend API with protected AI keys

• Docker configuration

• Production-ready deployment configuration

• Comprehensive documentation

• Strong error handling

• Automated tests



The code should prioritize readability, modular architecture, accessibility, security, and maintainability over unnecessary complexity.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://twin-tongue-bridge.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a17afa0-8f98-40be-9842-4efeb38fb979).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
