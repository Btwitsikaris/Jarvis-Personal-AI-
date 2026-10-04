import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Code2,
  FileText,
  Globe2,
  Link2,
  Menu,
  MessageSquarePlus,
  Mic,
  MicOff,
  Paperclip,
  PanelLeft,
  Search,
  Send,
  Settings2,
  ArrowRight,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import "./App.css";

// Three.js is large, so load it on demand instead of in the main bundle.
const JarvisSceneLazy = lazy(() => import("./components/JarvisThreeScene"));
const LandingBackgroundLazy = lazy(() => import("./components/LandingBackground"));
const JarvisThreeScene = (props: ComponentProps<typeof JarvisSceneLazy>) => (
  <Suspense fallback={null}><JarvisSceneLazy {...props} /></Suspense>
);
const LandingBackground = () => (
  <Suspense fallback={null}><LandingBackgroundLazy /></Suspense>
);

type Role = "user" | "assistant";
type Mode = "general" | "college" | "code";
type Source = { title: string; url: string; content: string };
type Message = { id: string; role: Role; content: string; fileName?: string; error?: boolean };
type ChatSession = { id: string; title: string; messages: Message[]; updatedAt: number };

const Jarvis_INTRO =
  "Good evening. I am Jarvis, your personal artificial intelligence assistant. I am here to help you analyze information, search the web, build projects, write and debug code, understand documents, and keep your work organized. How may I assist you?";
const starterPrompts = [
  "Introduce yourself",
  "Explain a complex topic in simple words",
  "Search the latest web development trends",
  "Help me plan my college project",
];
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function makeSession(): ChatSession {
  return { id: id(), title: "New chat", messages: [], updatedAt: Date.now() };
}

const MAX_SESSIONS = 60;
const MAX_DOC_CHARS = 50000;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const WEB_HINT = /\b(latest|today|tonight|yesterday|tomorrow|current(ly)?|recent(ly)?|news|price|prices|weather|score|scores|stock|stocks|search|look up|google|who is|who won|what happened|this (week|month|year)|release date|trending|202[5-9]|203\d)\b/i;

const safeGet = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key: string, value: string) => {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
};

function loadSessions(): ChatSession[] {
  try {
    const raw = JSON.parse(safeGet("jarvis-chats") || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s: any) => s && typeof s.id === "string" && Array.isArray(s.messages))
      .map((s: any): ChatSession => ({
        id: s.id,
        title: typeof s.title === "string" ? s.title : "New chat",
        updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
        messages: s.messages
          .filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
          .map((m: any): Message => ({
            id: typeof m.id === "string" ? m.id : id(),
            role: m.role,
            content: m.content,
            fileName: typeof m.fileName === "string" ? m.fileName : undefined,
            error: m.error === true,
          })),
      }));
  } catch {
    return [];
  }
}

function safeHost(url: string): string {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname : "";
  } catch {
    return "";
  }
}

function cleanSources(input: unknown): Source[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((s: any) => s && typeof s.url === "string" && safeHost(s.url))
    .map((s: any) => ({ title: String(s.title || s.url).slice(0, 200), url: s.url, content: String(s.content || "") }));
}

class ApiError extends Error {
  code?: string;
}

// POST helper: handles non-JSON replies, network errors and the optional access-code gate.
async function api(path: string, body: unknown, canPrompt = true): Promise<any> {
  const code = safeGet("jarvis-access-code") || "";
  let r: Response;
  try {
    r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(code ? { "x-access-code": code } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Network error. Check your connection and try again.");
  }
  let data: any = null;
  try { data = await r.json(); } catch {}
  if (r.status === 401 && data?.code === "ACCESS_REQUIRED") {
    if (canPrompt) {
      const entered = window.prompt(code ? "That access code was not accepted. Enter the access code:" : "Enter the access code to use Jarvis:");
      if (entered && entered.trim()) {
        safeSet("jarvis-access-code", entered.trim());
        return api(path, body, false);
      }
    }
    const err = new ApiError("A valid access code is required.");
    err.code = "ACCESS_REQUIRED";
    throw err;
  }
  if (!r.ok) throw new ApiError(typeof data?.error === "string" ? data.error : `Request failed (${r.status}).`);
  if (!data) throw new ApiError("The server returned an unexpected response.");
  return data;
}


function LandingPage({ onStart }: { onStart: () => void }) {
  const scrollToAbout = () => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="landing-page">
      <div className="landing-three-bg"><LandingBackground /></div>
      <div className="landing-atmosphere" aria-hidden="true" />
      <header className="landing-nav">
        <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Jarvis home">
          <video className="landing-brand-loop" src="/assets/jarvis-loop.mp4" autoPlay loop muted playsInline preload="auto" aria-label="Jarvis" />
          <span>Jarvis</span>
        </button>
        <div className="landing-nav-actions">
          <button className="landing-nav-link" onClick={scrollToAbout}>About</button>
          <button className="landing-start-small" onClick={onStart}>Start chat</button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <h1 className="landing-title">Meet <span className="landing-title-name"><img src="/assets/jarvis-logo.png" alt="" aria-hidden="true" />Jarvis.</span></h1>
            <p className="landing-copy">A calm, capable AI workspace for asking questions, researching the web, understanding documents, building software, and turning ideas into finished work.</p>
            <div className="landing-actions">
              <button className="landing-btn primary" onClick={onStart}>Start chat <ArrowRight size={17} /></button>
              <button className="landing-btn secondary" onClick={scrollToAbout}>About Jarvis</button>
            </div>
            <div className="landing-capabilities">
              <span>Voice</span><i /> <span>Web research</span><i /> <span>Documents</span><i /> <span>Code</span><i /> <span>Projects</span>
            </div>
          </div>
        </section>

        <section id="about" className="landing-about">
          <div className="about-inner">
            <p className="landing-kicker">ABOUT</p>
            <h2>Built to feel less like a tool, and more like a second desk.</h2>
            <p>Jarvis is a focused AI workspace designed around one simple idea: useful intelligence should stay out of the way until you need it. Ask a quick question, explore something current, drop in a document, write code, or keep a project moving without leaving the same conversation.</p>
            <p>It combines conversational AI with live web research, document understanding, voice interaction, coding support, and persistent conversation history. The interface stays deliberately quiet and black so the work—not the interface—gets your attention.</p>
            <p>Jarvis is made for curiosity, building, studying, and getting things done. Start with a question. Let the system handle the busywork.</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-grid">
          <div className="footer-about">
            <div className="footer-brand"><img src="/assets/jarvis-logo.png" alt="Jarvis" /><span>Jarvis</span></div>
            <p>A private-feeling, focused interface for research, creation, and everyday problem solving.</p>
          </div>
          <div className="footer-contact">
            <p className="footer-label">CONTACT</p>
            <p>Designed by <strong>Aniket Majumdar</strong></p>
            <a href="mailto:aniketmajumdar2006@gmail.com">aniketmajumdar2006@gmail.com</a>
            <p>for questions, bugs, or feedback</p>
          </div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Jarvis</span></div>
      </footer>
    </div>
  );
}

function ListeningIndicator({ speaking }: { speaking: boolean }) {
  return (
    <motion.div
      className={`listening-indicator ${speaking ? "speaking" : ""}`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      role="status"
      aria-live="polite"
    >
      <div className="listening-orb"><span /><span /><span /></div>
      <div className="listening-copy">
        <strong>{speaking ? "Listening…" : "Listening for your voice…"}</strong>
        <div className="voice-wave" aria-hidden="true">
          {Array.from({ length: 13 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 55}ms` }} />)}
        </div>
      </div>
      <span className="listening-hint">Tap mic to stop</span>
    </motion.div>
  );
}

function ChatApp() {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeId, setActiveId] = useState<string>(() => safeGet("jarvis-active-chat") || "");
  const [input, setInput] = useState("");
  const [web, setWeb] = useState(true);
  const [sources, setSources] = useState<Source[]>([]);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [mode, setMode] = useState<Mode>("general");
  const [fileName, setFileName] = useState("");
  const [fileContext, setFileContext] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [fileAnnounced, setFileAnnounced] = useState(false);

  const openLanding = () => {
    history.pushState(null, "", window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const bottom = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognition = useRef<any>(null);
  const listeningRef = useRef(false);
  const speechResetTimer = useRef<number | null>(null);
  const voices = useRef<SpeechSynthesisVoice[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef("");
  const baseSpeech = useRef("");
  const finalSpeech = useRef("");
  const rapidRestarts = useRef(0);
  inputRef.current = input;

  const activeSession = sessions.find((s) => s.id === activeId);
  const messages = activeSession?.messages || [];

  useEffect(() => {
    if (!activeId && sessions.length) setActiveId(sessions[0].id);
    if (activeId && !sessions.some((s) => s.id === activeId) && sessions.length) setActiveId(sessions[0].id);
  }, [sessions, activeId]);

  useEffect(() => {
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    // If storage is full, fall back to saving only the most recent chats instead of throwing.
    if (!safeSet("jarvis-chats", JSON.stringify(trimmed))) safeSet("jarvis-chats", JSON.stringify(trimmed.slice(0, 15)));
    if (activeId) safeSet("jarvis-active-chat", activeId);
  }, [sessions, activeId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    const loadVoices = () => {
      voices.current = window.speechSynthesis?.getVoices?.() || [];
    };
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      listeningRef.current = false;
      recognition.current?.stop();
      if (speechResetTimer.current) window.clearTimeout(speechResetTimer.current);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const speak = (text: string) => {
    if (!speakOn || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/```[\s\S]*?```/g, "code omitted").replace(/\[\d+\]/g, "").slice(0, 5000);
    const u = new SpeechSynthesisUtterance(clean);
    const available = voices.current.length ? voices.current : window.speechSynthesis.getVoices();
    const preferred =
      available.find((v) => /en-GB/i.test(v.lang) && /(Daniel|George|Arthur|Oliver|Google UK English Male|Microsoft George|Microsoft Ryan)/i.test(v.name)) ||
      available.find((v) => /en-GB/i.test(v.lang)) ||
      available.find((v) => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    u.lang = preferred?.lang || "en-GB";
    u.rate = 0.9;
    u.pitch = 0.78;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  };

  const isIdentityQuestion = (text: string) =>
    /\b(who are you|what are you|introduce yourself|tell me about yourself|what is jarvis|who is jarvis|about jarvis|your introduction|your intro)\b/i.test(text);

  const ensureSession = () => {
    const existing = sessions.find((s) => s.id === activeId);
    if (existing) return existing;
    const fresh = makeSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    return fresh;
  };

  const updateSession = (sessionId: string, nextMessages: Message[], title?: string, fallback?: ChatSession) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === sessionId);
      if (!exists) {
        const base = fallback || makeSession();
        return [{ ...base, id: sessionId, messages: nextMessages, title: title || base.title, updatedAt: Date.now() }, ...prev];
      }
      return prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages: nextMessages, title: title || s.title, updatedAt: Date.now() }
          : s,
      );
    });
  };

  const newChat = () => {
    window.speechSynthesis?.cancel();
    setSources([]);
    setInput("");
    setFileName("");
    setFileContext("");
    const fresh = makeSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
  };

  const deleteSession = (sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeId) setActiveId(next[0]?.id || "");
      return next;
    });
    setSources([]);
  };

  const clearCurrent = () => {
    if (!activeId) return newChat();
    updateSession(activeId, [], "New chat");
    setInput("");
    setSources([]);
    setFileName("");
    setFileContext("");
    window.speechSynthesis?.cancel();
  };

  const notify = (content: string) => {
    const session = ensureSession();
    updateSession(session.id, [...session.messages, { id: id(), role: "assistant", content, error: true }], session.title, session);
  };

  const stopMic = () => {
    listeningRef.current = false;
    setListening(false);
    setVoiceSpeaking(false);
    if (speechResetTimer.current) window.clearTimeout(speechResetTimer.current);
    try { recognition.current?.stop(); } catch {}
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      notify("Voice input is not supported here. Please use Chrome or Edge and allow microphone access.");
      return;
    }
    if (listeningRef.current) {
      stopMic();
      return;
    }

    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    baseSpeech.current = inputRef.current.trimEnd();
    finalSpeech.current = "";
    rapidRestarts.current = 0;

    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalSpeech.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      // Keep everything already spoken (and typed) and add the live transcript on top.
      const spoken = (finalSpeech.current + interim).trim();
      setInput([baseSpeech.current, spoken].filter(Boolean).join(" "));
      rapidRestarts.current = 0;
      setVoiceSpeaking(true);
      if (speechResetTimer.current) window.clearTimeout(speechResetTimer.current);
      speechResetTimer.current = window.setTimeout(() => setVoiceSpeaking(false), 700);
    };

    r.onend = () => {
      if (!listeningRef.current) {
        setListening(false);
        setVoiceSpeaking(false);
        return;
      }
      // Chrome ends recognition after silence. Restart, but give up if it keeps ending without results.
      rapidRestarts.current += 1;
      if (rapidRestarts.current > 5) {
        stopMic();
        notify("Voice input stopped after a period of silence. Tap the microphone to start again.");
        return;
      }
      baseSpeech.current = inputRef.current.trimEnd();
      finalSpeech.current = "";
      window.setTimeout(() => {
        if (listeningRef.current) {
          try { r.start(); } catch {}
        }
      }, 250);
    };

    r.onerror = (event: any) => {
      const err = event?.error;
      if (err === "no-speech" || err === "aborted") return;
      stopMic();
      notify(
        err === "not-allowed" || err === "service-not-allowed" ? "Microphone access was blocked. Allow it in your browser's site settings and try again."
        : err === "audio-capture" ? "No microphone was found."
        : err === "network" ? "Voice recognition needs an internet connection."
        : "Voice input stopped unexpectedly.",
      );
    };

    recognition.current = r;
    listeningRef.current = true;
    setListening(true);
    setVoiceSpeaking(false);
    try {
      r.start();
    } catch {
      stopMic();
    }
  };

  const setDocument = (name: string, text: string, prompt: string) => {
    setFileContext(text.slice(0, MAX_DOC_CHARS));
    setFileName(name);
    setFileAnnounced(false);
    setInput((prev) => (prev.trim() ? prev : prompt));
  };

  const loadPdf = async (file: File) => {
    if (file.size > MAX_PDF_BYTES) {
      notify("That PDF is larger than 15 MB. Please attach a smaller file.");
      return;
    }
    setFileLoading(true);
    try {
      // Bundled locally (no third-party CDN). The legacy build supports older browsers.
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf.mjs"),
        import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const c = await page.getTextContent();
        text += `\n--- Page ${i} ---\n` + c.items.map((x: any) => x.str ?? "").join(" ");
        if (text.length > MAX_DOC_CHARS) break;
      }
      await pdf.destroy();
      if (text.replace(/--- Page \d+ ---/g, "").trim().length < 20) {
        notify("I couldn't find any selectable text in that PDF. It may be a scan or an image-only PDF.");
        return;
      }
      setDocument(file.name, text, `Analyze the attached document (${file.name}) and summarize the key points.`);
    } catch {
      notify("I couldn't read that PDF. Try a text-based PDF or TXT/MD/CSV/JSON file.");
    } finally {
      setFileLoading(false);
    }
  };

  const attach = async (file?: File) => {
    if (!file) return;
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      await loadPdf(file);
      return;
    }
    if (file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name)) {
      setFileLoading(true);
      try {
        // Read only the first few hundred KB so huge files can't freeze the tab.
        const text = (await file.slice(0, MAX_DOC_CHARS * 4).text()).replace(/\u0000/g, "");
        if (!text.trim()) {
          notify("That file looks empty.");
          return;
        }
        setDocument(file.name, text, `Analyze the attached file (${file.name}).`);
      } catch {
        notify("I couldn't read that file.");
      } finally {
        setFileLoading(false);
      }
      return;
    }
    notify("Jarvis currently supports PDF, TXT, MD, CSV and JSON attachments.");
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || busy || searching) return;
    if (listeningRef.current) stopMic();

    const session = ensureSession();
    const sessionId = session.id;
    const user: Message = { id: id(), role: "user", content: text, fileName: fileName && !fileAnnounced ? fileName : undefined };
    const nextMessages = [...session.messages, user];
    const title = session.title === "New chat" ? text.replace(/\s+/g, " ").slice(0, 48) : session.title;
    updateSession(sessionId, nextMessages, title, session);
    setInput("");
    setSources([]);
    if (fileName) setFileAnnounced(true);

    if (isIdentityQuestion(text)) {
      updateSession(sessionId, [...nextMessages, { id: id(), role: "assistant", content: Jarvis_INTRO }], title, session);
      speak(Jarvis_INTRO);
      return;
    }

    try {
      let found: Source[] = [];
      let searchFailed = false;
      if (web && WEB_HINT.test(text)) {
        setSearching(true);
        try {
          const d = await api("/api/search", { query: text.slice(0, 300) });
          found = cleanSources(d.results);
        } catch (e) {
          if ((e as ApiError).code === "ACCESS_REQUIRED") throw e;
          searchFailed = true; // degrade gracefully: still answer, but say so
        }
        setSources(found);
      }
      setSearching(false);
      setBusy(true);
      // Don't send local error notices back to the model as conversation history.
      const history = nextMessages.filter((m) => !m.error).slice(-12).map(({ role, content }) => ({ role, content }));
      const d = await api("/api/chat", { messages: history, sources: found, mode, document: fileContext, documentName: fileName });
      const reply = String(d.message || "") + (searchFailed ? "\n\n_Live web search was unavailable, so this answer may be out of date._" : "");
      updateSession(sessionId, [...nextMessages, { id: id(), role: "assistant", content: reply }], title, session);
      speak(reply);
    } catch (e) {
      updateSession(sessionId, [
        ...nextMessages,
        { id: id(), role: "assistant", error: true, content: `I couldn't complete that request. ${e instanceof Error ? e.message : "Something went wrong."}` },
      ], title, session);
    } finally {
      setSearching(false);
      setBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const week = startToday - 6 * 86400000;
    return {
      today: sessions.filter((s) => s.updatedAt >= startToday),
      previous: sessions.filter((s) => s.updatedAt < startToday && s.updatedAt >= week),
      older: sessions.filter((s) => s.updatedAt < week),
    };
  }, [sessions]);

  const sessionList = (items: ChatSession[]) =>
    items.map((session) => (
      <div className={`history-item ${session.id === activeId ? "active" : ""}`} key={session.id}>
        <button onClick={() => { setActiveId(session.id); setSources([]); setInput(""); }} title={session.title}>
          <span>{session.title || "New chat"}</span>
        </button>
        <button className="history-delete" aria-label="Delete chat" onClick={() => deleteSession(session.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    ));

  return (
    <div className="app">
      <AnimatePresence initial={false}>
        {sidebar && (
          <motion.aside className="sidebar" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2 }}>
            <div className="sidebar-head">
              <button className="brand" onClick={openLanding} aria-label="Jarvis home">
                <img className="brand-logo" src="/assets/jarvis-logo.png" alt="Jarvis" />
                <span className="brand-name">Jarvis</span>
              </button>
              <button className="sidebar-close" onClick={() => setSidebar(false)} aria-label="Close sidebar"><X size={18} /></button>
            </div>

            <button className="new-chat" onClick={newChat}><MessageSquarePlus size={17} /> New chat</button>

            <div className="history">
              {grouped.today.length > 0 && <><div className="history-label">Today</div>{sessionList(grouped.today)}</>}
              {grouped.previous.length > 0 && <><div className="history-label">Previous 7 days</div>{sessionList(grouped.previous)}</>}
              {grouped.older.length > 0 && <><div className="history-label">Older</div>{sessionList(grouped.older)}</>}
              {sessions.length === 0 && <div className="history-empty">Your conversations will appear here.</div>}
            </div>

            <div className="sidebar-bottom">
              <button className="sidebar-tool" onClick={() => setShowTools((v) => !v)}><Settings2 size={16} /> Tools & settings</button>
              <button className="sidebar-tool" onClick={clearCurrent}><Trash2 size={16} /> Clear current chat</button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setSidebar((v) => !v)} aria-label="Toggle sidebar">
            {sidebar ? <PanelLeft size={19} /> : <Menu size={19} />}
          </button>
          <div className="top-title"><span className="top-status" /> Jarvis</div>
          <div className="top-actions">
            <button className={`tool-chip ${web ? "on" : ""}`} onClick={() => setWeb((v) => !v)}><Globe2 size={15} /> Web <b>{web ? "AUTO" : "OFF"}</b></button>
            <select className="mode-select" value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Mode">
              <option value="general">General</option>
              <option value="college">College / Project</option>
              <option value="code">Code Lab</option>
            </select>
            <button className="icon-btn" onClick={() => setSpeakOn((v) => !v)} aria-label="Toggle voice responses">{speakOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          </div>
        </header>

        <section className="chat-area">
          {messages.length === 0 ? (
            <motion.div className="welcome" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="welcome-core"><JarvisThreeScene /></div>
              <h1>How can I help you?</h1>
              <p>Ask Jarvis anything. Search the web, work with documents, write code, or continue a project.</p>
              <div className="starter-grid">
                {starterPrompts.map((prompt) => <button key={prompt} className="starter" onClick={() => send(prompt)}>{prompt}</button>)}
              </div>
            </motion.div>
          ) : (
            <div className="conversation">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div key={m.id} className={`message-row ${m.role}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="message-inner">
                      {m.role === "assistant" && <div className="message-brand"><img src="/assets/jarvis-logo.png" alt="Jarvis" /></div>}
                      <div className="bubble">
                        {m.fileName && <div className="file-pill"><FileText size={12} /> {m.fileName}</div>}
                        <div className="message-text">
                          {m.role === "assistant" ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              skipHtml
                              components={{
                                // Block images (data-exfiltration vector) and open links safely.
                                img: () => null,
                                a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                              }}
                            >{m.content}</ReactMarkdown>
                          ) : (
                            <span>{m.content}</span>
                          )}
                        </div>
                        {m.role === "assistant" && <button className="speak-btn" onClick={() => speak(m.content)}><Volume2 size={13} /> Read aloud</button>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {(busy || searching) && (
                <motion.div className="message-row assistant" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="message-inner"><div className="message-brand thinking-mark"><JarvisThreeScene compact active /></div><div className="bubble thinking"><span>{searching ? "Searching the web…" : "Thinking…"}</span></div></div>
                </motion.div>
              )}
              <div ref={bottom} />
            </div>
          )}

          {sources.length > 0 && (
            <motion.div className="sources-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="sources-title"><Search size={14} /> Sources <span>{sources.length}</span></div>
              <div className="sources-list">
                {sources.map((s, i) => <a className="source-card" href={s.url} target="_blank" rel="noreferrer" key={`${s.url}-${i}`}><span className="source-num">{i + 1}</span><div><b>{s.title}</b><small>{safeHost(s.url)}</small></div><Link2 size={14} /></a>)}
              </div>
            </motion.div>
          )}

          {showTools && (
            <div className="tools-panel">
              <div><Globe2 size={16} /><span><b>Web search</b><small>Searches automatically for current or time-sensitive questions</small></span><button onClick={() => setWeb((v) => !v)}>{web ? "On" : "Off"}</button></div>
              <div><Volume2 size={16} /><span><b>Voice responses</b><small>Read Jarvis answers aloud</small></span><button onClick={() => setSpeakOn((v) => !v)}>{speakOn ? "On" : "Off"}</button></div>
              <div><Code2 size={16} /><span><b>Mode</b><small>Change how Jarvis approaches your request</small></span><b className="tool-value">{mode}</b></div>
            </div>
          )}

          {fileName && <div className="attachment-bar"><FileText size={15} /><span>{fileName} attached to this chat</span><button onClick={() => { setFileName(""); setFileContext(""); setFileAnnounced(false); }}>Remove</button></div>}

          <AnimatePresence>
            {listening && <ListeningIndicator speaking={voiceSpeaking} />}
          </AnimatePresence>

          <div className="composer-wrap">
            <div className="composer">
              <input ref={fileRef} hidden type="file" accept="application/pdf,text/plain,text/markdown,text/csv,application/json" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void attach(f); }} />
              <button className="composer-icon" onClick={() => fileRef.current?.click()} disabled={fileLoading} aria-label="Attach file"><Paperclip size={19} /></button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Message Jarvis"
                rows={1}
              />
              <div className="composer-actions">
                <button className={`composer-icon mic ${listening ? "recording" : ""}`} onClick={toggleMic} aria-label={listening ? "Stop listening" : "Voice input"}>{listening ? <MicOff size={19} /> : <Mic size={19} />}</button>
                <button className="send" disabled={!input.trim() || busy || searching} onClick={() => send()} aria-label="Send message"><Send size={17} /></button>
              </div>
            </div>
            <div className="composer-note">Jarvis may make mistakes. Check important information.</div>
          </div>
        </section>
      </main>
    </div>
  );
}


export default function App() {
  const [landing, setLanding] = useState(() => window.location.hash !== "#chat");

  useEffect(() => {
    const onHash = () => setLanding(window.location.hash !== "#chat");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openChat = () => {
    window.location.hash = "chat";
    setLanding(false);
  };

  if (landing) return <LandingPage onStart={openChat} />;
  return <ChatApp />;
}
