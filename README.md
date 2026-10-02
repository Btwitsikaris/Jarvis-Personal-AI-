JARVIS — Personal AI Assistant
A clean, ChatGPT-style JARVIS interface with:

Text chat
Voice input through the browser microphone
AI voice responses
Tavily live web search + source cards
PDF/TXT/MD/CSV/JSON understanding
Groq-powered answers
College / Project mode
Code Lab mode
Persistent chat history in the browser
Pure-black, minimal UI
Setup
npm install
Create .env from .env.example:

GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
Run:

npm run dev
Open the local URL Vite prints in the terminal.

API key troubleshooting
For local development, keep the existing working keys in a .env file in the project root:

GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
Restart npm run dev after changing .env. The Vite development middleware now deliberately prefers the project .env values over stale shell environment variables. Quotes and surrounding whitespace are cleaned server-side. No API key is sent to the browser.

If voice input is supported by the browser, click the microphone. Jarvis shows a live listening panel with an animated waveform and pulsing orb while recognition is active. Chrome can briefly end speech recognition after silence; Jarvis automatically restarts it until you tap the microphone again.

Visual engine
The landing background and Jarvis core/thinking animation use Three.js. Run npm install after extracting the project so the three and @types/three dependencies are installed.
