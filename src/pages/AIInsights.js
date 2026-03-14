import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const COLORS = ["#0EA875", "#2563EB", "#D4960A", "#E05555", "#7C3AED", "#06B6D4"];

const QA = [
  { q: "How do I add an expense?", a: "Go to Expenses → click '+ Add Expense' → fill in description, amount, category → select friends → choose Equal, % or Exact split → click Add." },
  { q: "How do I add friends?", a: "Go to Friends tab → enter your friend's email (they must be registered) → click Search → click + Add Friend." },
  { q: "How does settlement work?", a: "Settlements tab shows the minimum payments needed to clear all debts. When someone pays in real life, click '✓ Received' or 'I Paid' to record it." },
  { q: "How do I split unequally?", a: "When adding expense, choose '% Percent' to split by percentage, or '# Exact' to enter custom amounts for each person." },
  { q: "How do I delete an expense?", a: "Go to Expenses tab → click the 🗑 button next to any expense to delete it permanently." },
  { q: "Why is my balance wrong?", a: "Balances calculate in real time from your expenses. Make sure all expenses have the correct members and amounts added." },
  { q: "How do I settle a debt?", a: "In Settlements → Pending tab, click '✓ Received' when someone pays you, or 'I Paid' when you pay someone. It moves to History." },
  { q: "Can friends see my expenses?", a: "Only expenses where you are both members are visible to each other. Your other expenses stay private." },
  { q: "How to reduce expenses?", a: "Check the By Category chart on Dashboard to see where you spend most. Set a monthly budget for that category and track weekly." },
  { q: "How do I share this app?", a: "Share the link moneyspliting.netlify.app with friends. They register with their email and you can add each other as friends." },
];

export default function AIInsights() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! 👋 I'm your Splitter assistant. I can answer questions about the app and show your spending insights. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, settled: 0, categoryData: [], monthlyData: [], topSpend: 0, friendCount: 0 });
  const [activeTab, setActiveTab] = useState("chat");
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
      const settled = exps.filter(e => e.settled).length;

      // Category data
      const catMap = {};
      exps.forEach(e => {
        const cat = e.category || "Other";
        catMap[cat] = (catMap[cat] || 0) + e.amount / e.memberIds.length;
      });
      const categoryData = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value], i) => ({ name: name.split(" ").slice(1).join(" ") || name, value: parseFloat(value.toFixed(0)), color: COLORS[i] }));

      // Monthly data
      const monthMap = {};
      exps.forEach(e => {
        if (!e.createdAt) return;
        const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date();
        const key = d.toLocaleString("default", { month: "short" });
        monthMap[key] = (monthMap[key] || 0) + e.amount / e.memberIds.length;
      });
      const monthlyData = Object.entries(monthMap).slice(-6).map(([month, amount]) => ({ month, amount: parseFloat(amount.toFixed(0)) }));

      const fq = query(collection(db, "friends"), where("userId", "==", user.uid));
      const fsnap = await getDocs(fq);

      setStats({ total: total.toFixed(0), pending, settled, categoryData, monthlyData, topSpend: categoryData[0]?.value || 0, friendCount: fsnap.size });
    }
    load();
  }, [user]);

  function findAnswer(question) {
    const q = question.toLowerCase();
    const match = QA.find(item =>
      item.q.toLowerCase().split(" ").some(word => word.length > 3 && q.includes(word))
    );
    if (match) return match.a;
    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) return "Hello! How can I help you with Splitter today? 😊";
    if (q.includes("thank")) return "You're welcome! Feel free to ask anything else 😊";
    if (q.includes("total") || q.includes("spent")) return `You've spent ₹${stats.total} total across all your expenses.`;
    if (q.includes("pending")) return `You have ${stats.pending} pending expense${stats.pending !== 1 ? "s" : ""} that need to be settled.`;
    if (q.includes("friend")) return `You have ${stats.friendCount} friend${stats.friendCount !== 1 ? "s" : ""} on Splitter.`;
    if (q.includes("category") || q.includes("most")) return stats.categoryData[0] ? `Your highest spending category is ${stats.categoryData[0].name} at ₹${stats.categoryData[0].value}.` : "No spending data yet.";
    return "I'm not sure about that! Try asking about expenses, friends, settlements, or splits. Or click a suggested question below 👇";
  }

  function send(text) {
    const msg = text || input;
    if (!msg.trim()) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "ai", text: findAnswer(msg) }]);
    }, 350);
  }

  const tips = [
    { icon: "💡", title: "Split immediately", desc: "Add expenses right after paying to avoid forgetting details." },
    { icon: "📊", title: "Review monthly", desc: "Check your spending patterns every month to stay on budget." },
    { icon: "⚡", title: "Settle weekly", desc: "Settle debts weekly to keep friendships stress-free." },
    { icon: "🎯", title: "Use exact splits", desc: "For unequal orders like food, use exact amounts for fairness." },
    { icon: "🔄", title: "Settle one by one", desc: "Settle with one person at a time to avoid confusion." },
    { icon: "💰", title: "Track categories", desc: "Label every expense with a category to spot overspending." },
  ];

  return (
    <div className="page-content">
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { label: "Total Spent", value: `₹${stats.total}`, color: "#2563EB", icon: "💸" },
          { label: "Pending", value: stats.pending, color: "#E05555", icon: "⏳" },
          { label: "Settled", value: stats.settled, color: "#0EA875", icon: "✅" },
          { label: "Friends", value: stats.friendCount, color: "#D4960A", icon: "👥" },
        ].map((s, i) => (
          <div className="stat-card" key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {["chat", "insights", "tips"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{
              padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer",
              fontFamily: "var(--font-b)", fontSize: 13, fontWeight: 500, transition: "all 0.15s",
              background: activeTab === t ? "var(--surface)" : "transparent",
              color: activeTab === t ? "var(--accent)" : "var(--muted)",
              boxShadow: activeTab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              textTransform: "capitalize"
            }}>
            {t === "chat" ? "💬 Chat" : t === "insights" ? "📊 Insights" : "💡 Tips"}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 480 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ color: "#0EA875" }}>✦</span> Splitter Assistant
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#8891AA", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>Ask anything about the app</span>
          </div>

          <div className="ai-messages" style={{ flex: 1, maxHeight: 320 }}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === "ai" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #0EA875, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>✦</div>
                )}
                <div className="msg-bubble" style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 8px" }}>
            {QA.slice(0, 5).map((item, i) => (
              <button key={i} className="btn btn-secondary btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => send(item.q)}>
                {item.q}
              </button>
            ))}
          </div>

          <div className="ai-input-row">
            <input className="ai-input" placeholder="Type your question..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()} />
            <button className="btn btn-primary" onClick={() => send()}>Send</button>
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === "insights" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card">
              <div className="card-title">Spending by Category</div>
              {stats.categoryData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#8891AA", fontSize: 13 }}>No data yet</div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <PieChart width={130} height={130}>
                    <Pie data={stats.categoryData} cx={60} cy={60} innerRadius={36} outerRadius={60} dataKey="value" paddingAngle={3}>
                      {stats.categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                    {stats.categoryData.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: "#8891AA" }}>{c.name}</span>
                        <span style={{ fontWeight: 600 }}>₹{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Monthly Spending</div>
              {stats.monthlyData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#8891AA", fontSize: 13 }}>No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.monthlyData}>
                    <XAxis dataKey="month" tick={{ fill: "#8891AA", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E6EF", borderRadius: 8, fontSize: 12 }} formatter={v => `₹${v}`} />
                    <Bar dataKey="amount" fill="#2563EB" radius={[4, 4, 0, 0]} name="Spent" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Spending Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
              {[
                { label: "Total Expenses", value: `₹${stats.total}`, sub: "all time", color: "#2563EB" },
                { label: "Top Category", value: stats.categoryData[0]?.name || "N/A", sub: `₹${stats.categoryData[0]?.value || 0} spent`, color: "#0EA875" },
                { label: "Settlement Rate", value: stats.settled + stats.pending > 0 ? `${Math.round((stats.settled / (stats.settled + stats.pending)) * 100)}%` : "N/A", sub: `${stats.settled} of ${stats.settled + stats.pending} done`, color: "#D4960A" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center", padding: "16px", background: "var(--surface2)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: "#8891AA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#8891AA", marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tips Tab */}
      {activeTab === "tips" && (
        <div className="card">
          <div className="card-title">💡 Smart Money Tips</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ padding: "16px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{tip.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{tip.title}</div>
                <div style={{ fontSize: 13, color: "#8891AA", lineHeight: 1.5 }}>{tip.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
