import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";

const QA = [
  {
    q: "How do I add an expense?",
    a: "Go to the Expenses tab → click '+ Add Expense' → enter description, amount, category → select friends to split with → choose Equal, Percentage or Exact split → click Add Expense."
  },
  {
    q: "How do I add friends?",
    a: "Go to the Friends tab → type your friend's email address (they must have a Splitter account) → click Search → click + Add Friend."
  },
  {
    q: "How does settlement work?",
    a: "The Settlements tab automatically calculates the minimum number of payments needed to clear all debts. When someone pays you in real life, click 'Record' to mark it done."
  },
  {
    q: "How do I split unequally?",
    a: "When adding an expense, select '% Percent' to split by percentage or '# Exact' to enter exact amounts for each person."
  },
  {
    q: "How do I mark an expense as settled?",
    a: "Go to Expenses tab → find the expense → click 'Mark Settled' button next to it. Only expenses you paid for will show this button."
  },
  {
    q: "How do I delete an expense?",
    a: "Go to Expenses tab → click the 🗑 delete button next to any expense to remove it permanently."
  },
  {
    q: "Why is my balance showing wrong?",
    a: "Balances update in real time. If something looks off, check that all expenses are added correctly with the right members and amounts."
  },
  {
    q: "How do I remove a friend?",
    a: "Go to Friends tab → find the friend → click 'Remove' button next to their name."
  },
  {
    q: "Can my friends see my expenses?",
    a: "Yes! Only expenses where both of you are members will be visible. Private expenses are only visible to their members."
  },
  {
    q: "How do I share the app with friends?",
    a: "Share this link: moneyspliting.netlify.app — your friends can register with their email and you can then add each other as friends."
  },
];

export default function AIInsights() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! 👋 I'm the Splitter assistant. Ask me anything about using the app, or click one of the questions below!" }
  ]);
  const [input, setInput] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, topCat: "N/A" });
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const q = query(collection(db, "expenses"), where("memberIds", "array-contains", user.uid));
      const snap = await getDocs(q);
      const exps = snap.docs.map(d => d.data());
      const total = exps.reduce((s, e) => s + e.amount / e.memberIds.length, 0);
      const pending = exps.filter(e => !e.settled).length;
      const catMap = {};
      exps.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + 1; });
      const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
      setStats({ total: total.toFixed(0), pending, topCat });
    }
    load();
  }, [user]);

  function findAnswer(question) {
    const q = question.toLowerCase();
    const match = QA.find(item =>
      item.q.toLowerCase().split(" ").some(word => word.length > 3 && q.includes(word))
    );
    if (match) return match.a;
    if (q.includes("hello") || q.includes("hi")) return "Hello! How can I help you with Splitter today?";
    if (q.includes("thank")) return "You're welcome! Let me know if you need anything else 😊";
    if (q.includes("total") || q.includes("spent")) return `You've spent ₹${stats.total} total across all expenses.`;
    if (q.includes("pending")) return `You have ${stats.pending} pending expense${stats.pending !== 1 ? "s" : ""}.`;
    return "I'm not sure about that. Try asking about adding expenses, friends, settlements, or splitting options. Or click one of the suggested questions below!";
  }

  function send(text) {
    const msg = text || input;
    if (!msg.trim()) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setTimeout(() => {
      const answer = findAnswer(msg);
      setMessages(prev => [...prev, { role: "ai", text: answer }]);
    }, 400);
  }

  return (
    <div className="page-content">
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[
          { label: "Total Spent", value: `₹${stats.total}`, color: "#2563EB" },
          { label: "Pending", value: stats.pending, color: "#E05555" },
          { label: "Top Category", value: stats.topCat?.split(" ").slice(1).join(" ") || "N/A", color: "#0EA875" },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 480 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#0EA875" }}>✦</span> Splitter Assistant
        </div>

        <div className="ai-messages" style={{ flex: 1, maxHeight: 340 }}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "ai" && <div className="ai-avatar">✦</div>}
              <div className="msg-bubble" style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
          {QA.slice(0, 5).map((item, i) => (
            <button key={i} className="btn btn-secondary btn-sm"
              style={{ fontSize: 11 }}
              onClick={() => send(item.q)}>
              {item.q}
            </button>
          ))}
        </div>

        <div className="ai-input-row">
          <input className="ai-input" placeholder="Ask a question..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()} />
          <button className="btn btn-primary" onClick={() => send()}>↑</button>
        </div>
      </div>
    </div>
  );
}
