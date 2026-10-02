import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useRef, useState } from "react";
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
import JarvisThreeScene from "./components/JarvisThreeScene";
import LandingBackground from "./components/LandingBackground";
import "./App.css";

type Role = "user" | "assistant";
type Mode = "general" | "college" | "code";
type Source = { title: string; url: string; content: string };
type Message = { id: string; role: Role; content: string; fileName?: string };
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
            <a href="mailto:aniketmajundar2006@gmail.com">aniketmajundar2006@gmail.com</a>
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
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("jarvis-chats") || "[]");
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem("jarvis-active-chat") || "");
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

  const activeSession = sessions.find((s) => s.id === activeId);
  const messages = activeSession?.messages || [];

  useEffect(() => {
    if (!activeId && sessions.length) setActiveId(sessions[0].id);
    if (activeId && !sessions.some((s) => s.id === activeId) && sessions.length) setActiveId(sessions[0].id);
  }, [sessions, activeId]);

  useEffect(() => {
    localStorage.setItem("jarvis-chats", JSON.stringify(sessions));
    if (activeId) localStorage.setItem("jarvis-active-chat", activeId);
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

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      const session = ensureSession();
      const current = session.messages;
      updateSession(session.id, [...current, { id: id(), role: "assistant", content: "Voice input is not supported here. Please use Chrome or Edge and allow microphone access." }], session.title, session);
      return;
    }

    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      setVoiceSpeaking(false);
      if (speechResetTimer.current) window.clearTimeout(speechResetTimer.current);
      recognition.current?.stop();
      return;
    }

    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;

    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setInput((prev) => {
        // SpeechRecognition may send a full transcript repeatedly. Replace the live
        // transcript while listening rather than appending duplicate phrases.
        return t || prev;
      });
      setVoiceSpeaking(true);
      if (speechResetTimer.current) window.clearTimeout(speechResetTimer.current);
      speechResetTimer.current = window.setTimeout(() => setVoiceSpeaking(false), 700);
    };

    r.onend = () => {
      if (listeningRef.current) {
        // Chrome can end recognition after a short silence even with continuous mode.
        // Restart it so the visual remains active until the user taps the mic again.
        try { r.start(); } catch {}
      } else {
        setListening(false);
        setVoiceSpeaking(false);
      }
    };

    r.onerror = (event: any) => {
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        listeningRef.current = false;
        setListening(false);
        setVoiceSpeaking(false);
        return;
      }
      // Ignore recoverable no-speech/aborted events while the user still has the mic on.
      if (!listeningRef.current) {
        setListening(false);
        setVoiceSpeaking(false);
      }
    };

    recognition.current = r;
    listeningRef.current = true;
    setListening(true);
    setVoiceSpeaking(false);
    try {
      r.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  };

  const loadPdf = async (file: File) => {
    setFileLoading(true);
    try {
      const load = new Function("u", "return import(u)");
      const pdfjs: any = await load("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.mjs";
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const c = await page.getTextContent();
        text += `\n--- Page ${i} ---\n` + c.items.map((x: any) => x.str).join(" ");
        if (text.length > 50000) break;
      }
      setFileContext(text.slice(0, 50000));
      setFileName(file.name);
      setInput(`Analyze the attached document (${file.name}) and summarize the key points.`);
    } catch {
      const session = ensureSession();
      updateSession(session.id, [...session.messages, { id: id(), role: "assistant", content: "I couldn't read that PDF. Try a text-based PDF or TXT/MD/CSV/JSON file." }], session.title, session);
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
      setFileContext((await file.text()).slice(0, 50000));
      setFileName(file.name);
      setInput(`Analyze the attached file (${file.name}).`);
      setFileLoading(false);
      return;
    }
    const session = ensureSession();
    updateSession(session.id, [...session.messages, { id: id(), role: "assistant", content: "Jarvis currently supports PDF, TXT, MD, CSV and JSON attachments." }], session.title, session);
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || busy || searching) return;

    const session = ensureSession();
    const sessionId = session.id;
    const currentMessages = session.messages;
    const user: Message = { id: id(), role: "user", content: text, fileName: fileName || undefined };
    const nextMessages = [...currentMessages, user];
    const title = session?.title === "New chat" ? text.replace(/\s+/g, " ").slice(0, 48) : session?.title;
    updateSession(sessionId, nextMessages, title, session);
    setInput("");
    setSources([]);

    if (isIdentityQuestion(text)) {
      const reply = Jarvis_INTRO;
      updateSession(sessionId, [...nextMessages, { id: id(), role: "assistant", content: reply }], title, session);
      speak(reply);
      setFileContext("");
      setFileName("");
      return;
    }

    let found: Source[] = [];
    try {
      const needsWeb = web && /\b(latest|today|tonight|yesterday|tomorrow|current|currently|recent|news|price|prices|weather|score|scores|stock|stocks|search the web|look up|who is|what happened|this week|this month|202[5-9]|203\d)\b/i.test(text);
      if (needsWeb) {
        setSearching(true);
        const r = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        found = d.results || [];
        setSources(found);
      }
      setSearching(false);
      setBusy(true);
      const history = nextMessages.map(({ role, content }) => ({ role, content }));
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, sources: found, mode, document: fileContext, documentName: fileName }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      updateSession(sessionId, [...nextMessages, { id: id(), role: "assistant", content: d.message }], title, session);
      speak(d.message);
      setFileContext("");
      setFileName("");
    } catch (e) {
      updateSession(sessionId, [
        ...nextMessages,
        {
          id: id(),
          role: "assistant",
          content: `I couldn't complete that request. ${e instanceof Error ? e.message : "Something went wrong."}`,
        },
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
            <button className={`tool-chip ${web ? "on" : ""}`} onClick={() => setWeb((v) => !v)}><Globe2 size={15} /> Web <b>{web ? "ON" : "OFF"}</b></button>
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
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
                {sources.map((s, i) => <a className="source-card" href={s.url} target="_blank" rel="noreferrer" key={`${s.url}-${i}`}><span className="source-num">{i + 1}</span><div><b>{s.title}</b><small>{new URL(s.url).hostname}</small></div><Link2 size={14} /></a>)}
              </div>
            </motion.div>
          )}

          {showTools && (
            <div className="tools-panel">
              <div><Globe2 size={16} /><span><b>Web search</b><small>Use Tavily for current information</small></span><button onClick={() => setWeb((v) => !v)}>{web ? "On" : "Off"}</button></div>
              <div><Volume2 size={16} /><span><b>Voice responses</b><small>Read Jarvis answers aloud</small></span><button onClick={() => setSpeakOn((v) => !v)}>{speakOn ? "On" : "Off"}</button></div>
              <div><Code2 size={16} /><span><b>Mode</b><small>Change how Jarvis approaches your request</small></span><b className="tool-value">{mode}</b></div>
            </div>
          )}

          {fileName && <div className="attachment-bar"><FileText size={15} /><span>{fileName} ready for Jarvis</span><button onClick={() => { setFileName(""); setFileContext(""); }}>Remove</button></div>}

          <AnimatePresence>
            {listening && <ListeningIndicator speaking={voiceSpeaking} />}
          </AnimatePresence>

          <div className="composer-wrap">
            <div className="composer">
              <input ref={fileRef} hidden type="file" accept="application/pdf,text/plain,text/markdown,text/csv,application/json" onChange={(e) => attach(e.target.files?.[0])} />
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
