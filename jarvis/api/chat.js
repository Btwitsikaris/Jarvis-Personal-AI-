const MODEL = "openai/gpt-oss-20b";

function cleanKey(value) {
  return typeof value === "string"
    ? value.trim().replace(/^([\'\"])(.*)\1$/, "$2")
    : "";
}

function getApiKey() {
  // The key is always read server-side. This also accepts a legacy variable name
  // so older working Jarvis .env files continue to work and no problem occur further .
  return cleanKey(process.env.GROQ_API_KEY || process.env.GROQ_KEY);
}
const MODES = { general:"Act as a versatile personal AI assistant.", college:"Act as a college/project mentor. Help with research, project planning, reports, presentations, explanations and viva preparation. Teach clearly.", code:"Act as a senior coding assistant. Diagnose bugs, explain root causes, propose maintainable solutions and provide complete code when useful." };
const BASE = `You are Jarvis, a modern personal AI assistant. Be helpful, concise, technically accurate, and transparent about uncertainty. Default to a short, natural answer appropriate to the question. For simple factual questions, answer in 2-5 sentences or a few bullets; do not turn simple questions into essays. Do not use tables unless the user asks for a comparison/table. Do not use LaTeX or \[...\] math delimiters unless the user asks for a mathematical derivation. Avoid unnecessary sections, repetition, and long background explanations. Cite supplied web evidence as [1], [2], etc. Never invent citations. Use simple markdown when useful. If an attached document is supplied, use it as reference material and say when it lacks the answer. If the user asks who you are, what you are, asks for an introduction, or asks about Jarvis, describe yourself as Jarvis and use this original introduction exactly: "Good evening. I am Jarvis, your personal artificial intelligence assistant. I am here to help you analyze information, search the web, build projects, write and debug code, understand documents, and keep your work organized. How may I assist you?" Do not reproduce dialogue from films, trailers, or other copyrighted recordings.`;
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const {messages,sources=[],mode="general",document="",documentName=""}=req.body||{};
 const key=getApiKey();
 if(!key)return res.status(500).json({error:"Missing GROQ_API_KEY on the server. Check the .env file and restart Vite."}); if(!Array.isArray(messages)||!messages.length)return res.status(400).json({error:"Messages must be a non-empty array."});
 const web=sources.length?`\nWEB SOURCES:\n${sources.map((s,i)=>`[${i+1}] ${s.title}\nURL: ${s.url}\n${s.content||""}`).join("\n\n")}`:"\nNo web sources were provided.";
 const doc=document?`\nATTACHED DOCUMENT: ${documentName||"document"}\n${document.slice(0,50000)}`:"\nNo attached document was provided.";
 const safe=messages.filter(m=>["user","assistant"].includes(m.role)&&typeof m.content==="string").slice(-12);
 try{const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:MODEL,messages:[{role:"system",content:`${BASE}\nMODE: ${MODES[mode]||MODES.general}${web}${doc}`},...safe],temperature:.55,max_tokens:1400})});const d=await r.json();if(!r.ok){
  const providerError=d?.error?.message||"AI request failed.";
  console.error(`Groq ${r.status}: ${providerError}`);
  return res.status(r.status).json({error:r.status===401?"Groq rejected the API key. Jarvis is reading the server-side GROQ_API_KEY from .env; no key is exposed to the browser.":providerError});
}return res.status(200).json({message:d?.choices?.[0]?.message?.content||"I couldn't generate a response.",model:MODEL})}catch(e){console.error(e);return res.status(500).json({error:"Internal server error."})}
}
