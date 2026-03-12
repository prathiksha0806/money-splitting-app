import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";

// ─── IMPORTANT: Add your Anthropic API key here ───────────────────
// Get it from: https://console.anthropic.com → API Keys


export default function AIInsights() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! I'm your Splitter AI 👋 I can analyze your expenses, suggest who to settle with first, and give you personalized money insights. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expenseContext, setExpenseContext] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!user) return;
    async function loadContext() {
      const q = query(collection(db, "expenses"), where("memberIds", "array-contains", user.uid));
      const snap = await getDocs(q);
      const exps = snap.docs.map(d => d.data());
      const total = exps.reduce((s, e) => s + e.amount / e.memberIds.length, 0);
      const pending = exps.filter(e => !e.settled);
      const catMap = {};
      exps.forEach(e => { const cat = e.category || "Other"; catMap[cat] = (catMap[cat] || 0) + e.amount / e.memberIds.length; });
      const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}: ₹${v.toFixed(0)}`).join(", ");
      setExpenseContext(`User: ${user.displayName}. Total spent: ₹${total.toFixed(0)}. Pending expenses: ${pending.length}. Top categories: ${topCat || "none yet"}.`);
    }
    loadContext();
  }, [user]);

  const SUGGESTIONS = [
    "Analyse my spending habits",
    "Who should I settle with first?",
    "How can I reduce my expenses?",
    "Give me a monthly budget tip",
  ];

  async function send(text) {
    const msg = text || input;
    if (!msg.trim()) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const history = messages.filter((_, i) => i > 0).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text
      }));

      const res = await fetch("/.netlify/functions/anthropic-proxy", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `You are a helpful financial AI assistant for Splitter, an expense-splitting app used in India. 
Respond concisely and practically. Use ₹ for currency. Give actionable advice.
User context: ${expenseContext}`,
    messages: [...history, { role: "user", content: msg }],
  }),
});

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content?.[0]?.text || "Sorry, I couldn't process that.";
      setMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", text: `Error: ${err.message}. Please check your API key in AIInsights.js` }]);
    }
    setLoading(false);
  }

  return (
    <div className="page-content">
      <div className="card ai-card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#0EA875" }}>✦</span> AI Financial Assistant
        </div>

        <div className="ai-messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "ai" && <div className="ai-avatar">✦</div>}
              <div className="msg-bubble" style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          ))}
          {loading && (
            <div className="msg ai">
              <div className="ai-avatar">✦</div>
              <div className="msg-bubble">
                <div className="typing"><div className="dot" /><div className="dot" /><div className="dot" /></div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="btn btn-secondary btn-sm" onClick={() => send(s)} style={{ fontSize: 11 }}>{s}</button>
          ))}
        </div>

        <div className="ai-input-row">
          <input className="ai-input" placeholder="Ask about your spending..." value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && send()} />
          <button className="btn btn-primary" onClick={() => send()} disabled={loading}>↑</button>
        </div>
      </div>
    </div>
  );
}
