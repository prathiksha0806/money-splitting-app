import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const COLORS = ["#0EA875", "#2563EB", "#D4960A", "#E05555", "#7C3AED", "#06B6D4"];

// ── Splitter app Q&A ─────────────────────────────────────────────
const SPLITTER_QA = [
  { keys: ["add expense", "how expense", "new expense", "create expense"], a: "Go to Expenses → '+ Add Expense' → fill description, amount, category → select friends → choose Equal / % / Exact split → click Add." },
  { keys: ["add friend", "how friend", "find friend"], a: "Go to Friends tab → type your friend's Splitter email → Search → click + Add Friend. They must be registered first." },
  { keys: ["how settle", "settlement work", "how does settle"], a: "Settlements tab shows minimum payments to clear all debts. Click '✓ Received' when someone pays you, or 'I Paid' when you pay someone." },
  { keys: ["unequal", "percentage", "exact split", "custom split"], a: "When adding an expense, choose '% Percent' for percentage split or '# Exact' to type custom amounts per person." },
  { keys: ["delete expense", "remove expense"], a: "Go to Expenses tab → click the 🗑 button next to any expense to delete it permanently." },
  { keys: ["share app", "invite", "link", "netlify"], a: "Share moneyspliting.netlify.app with friends. They register with their email and you add each other in the Friends tab." },
  { keys: ["mark settled", "settle expense"], a: "In Expenses tab, click 'Mark Settled' on expenses you paid for once everyone has paid you back." },
  { keys: ["balance wrong", "wrong balance", "incorrect"], a: "Balances update in real time from your active expenses. Check all expenses have correct members and amounts." },
  { keys: ["group", "create group"], a: "Currently Splitter works with individual friends. Add friends in the Friends tab and split any expense with multiple people." },
  { keys: ["history", "past settlement"], a: "Go to Settlements → History tab to see all past recorded payments." },
];

// ── Financial analysis engine ────────────────────────────────────
function analyseSpending(stats, name) {
  const total = parseFloat(stats.total) || 0;
  if (total === 0) return "📊 No spending data yet!\n\nStart adding expenses and I'll give you a detailed analysis of your spending habits, financial health, and personalised advice. 💡";

  const topCat = stats.categoryData[0];
  const topPct = topCat ? Math.round((topCat.value / total) * 100) : 0;
  const settleRate = (stats.settled + stats.pending) > 0 ? Math.round((stats.settled / (stats.settled + stats.pending)) * 100) : 0;
  const monthly = stats.monthlyData.length > 0 ? Math.round(stats.monthlyData.reduce((s, m) => s + m.amount, 0) / stats.monthlyData.length) : total;
  const { score } = getHealthScore(stats);

  let verdict = score >= 80 ? "✅ Your finances look healthy!" : score >= 60 ? "⚠️ Your finances are okay but need some attention." : "🔴 Your spending habits need improvement.";

  let analysis = `📊 **Spending Analysis — ${name}**\n\n`;
  analysis += `${verdict}\n\n`;
  analysis += `💰 Total spent: ₹${total.toLocaleString("en-IN")}\n`;
  analysis += `📅 Avg per month: ₹${monthly.toLocaleString("en-IN")}\n`;
  analysis += `🏆 Top spend: ${topCat ? `${topCat.name} (${topPct}% — ₹${topCat.value})` : "N/A"}\n`;
  analysis += `✅ Settlement rate: ${settleRate}%\n`;
  analysis += `📈 Health score: ${score}/100\n\n`;

  analysis += `**What this means:**\n`;
  if (topPct > 60) analysis += `⚠️ ${topCat?.name} dominates at ${topPct}% — unhealthy concentration. Diversify spending.\n`;
  else if (topPct > 40) analysis += `⚡ ${topCat?.name} is high at ${topPct}%. Manageable but worth monitoring.\n`;
  else analysis += `✅ Spending is well spread across categories — good sign!\n`;

  if (settleRate >= 80) analysis += `✅ Excellent settlement discipline (${settleRate}%) — you manage debts well!\n`;
  else if (settleRate >= 50) analysis += `⚠️ Settlement rate of ${settleRate}% is average. Try settling weekly.\n`;
  else analysis += `🔴 Low settlement rate (${settleRate}%) — too many pending debts. Settle up soon!\n`;

  if (stats.pending > 5) analysis += `⚠️ ${stats.pending} unsettled expenses — this can strain friendships.\n`;
  else if (stats.pending === 0) analysis += `✅ All expenses settled — excellent!\n`;

  analysis += `\n💡 Ask me "give me advice" for personalised tips!`;
  return analysis;
}

function giveAdvice(stats) {
  const total = parseFloat(stats.total) || 0;
  if (total === 0) return "💡 Add some expenses first and I'll give you personalised financial advice based on your actual spending data!";

  const topCat = stats.categoryData[0];
  const topPct = topCat ? Math.round((topCat.value / total) * 100) : 0;
  const settleRate = (stats.settled + stats.pending) > 0 ? Math.round((stats.settled / (stats.settled + stats.pending)) * 100) : 0;
  const monthly = stats.monthlyData.length > 0 ? Math.round(stats.monthlyData.reduce((s, m) => s + m.amount, 0) / stats.monthlyData.length) : total;

  let advice = `💡 **Personalised Financial Advice**\n\n`;

  // Spending advice
  advice += `**🍕 Spending Habits:**\n`;
  if (topPct > 50) {
    advice += `Your ${topCat?.name} spending (${topPct}%) is too high. Try:\n`;
    if (topCat?.name?.includes("Food")) advice += `• Cook at home 3x/week instead of eating out\n• Set a ₹${Math.round(topCat.value * 0.7)} food budget next month\n`;
    else if (topCat?.name?.includes("Fun")) advice += `• Look for free events and activities\n• Apply the 48-hour rule before fun purchases\n`;
    else if (topCat?.name?.includes("Travel")) advice += `• Carpool or use public transport more\n• Plan trips in advance for better rates\n`;
    else advice += `• Set a monthly limit for ${topCat?.name}\n• Review if all these expenses are necessary\n`;
  } else {
    advice += `✅ Good spending diversity! Keep it up.\n`;
  }

  // Settlement advice
  advice += `\n**💸 Debt Management:**\n`;
  if (settleRate < 60) {
    advice += `Your settlement rate (${settleRate}%) needs work:\n• Settle debts every Sunday\n• Send payment reminders after 3 days\n• Use Splitter's record feature immediately when paid\n`;
  } else {
    advice += `✅ Good settlement rate (${settleRate}%). Maintain this habit!\n`;
  }

  // Budget advice
  advice += `\n**💰 Budget Recommendation:**\n`;
  advice += `Based on your ₹${monthly}/month spending:\n`;
  advice += `• Needs (rent, food, transport): ₹${Math.round(monthly * 0.5)}\n`;
  advice += `• Wants (fun, dining, shopping): ₹${Math.round(monthly * 0.3)}\n`;
  advice += `• Savings/emergency fund: ₹${Math.round(monthly * 0.2)}\n`;

  advice += `\n**📈 Quick Win:**\n`;
  advice += `Reduce ${topCat?.name || "your top"} spending by 20% to save ₹${Math.round((topCat?.value || monthly) * 0.2)}/month!`;

  return advice;
}

function giveBudgetAdvice(stats) {
  const total = parseFloat(stats.total) || 0;
  if (total === 0) return "💰 Add some expenses first so I can create a personalised budget for you!";
  const monthly = stats.monthlyData.length > 0 ? Math.round(stats.monthlyData.reduce((s, m) => s + m.amount, 0) / stats.monthlyData.length) : Math.round(total);

  return `💰 **Personalised Budget Plan**\n\nBased on your avg ₹${monthly}/month:\n\n` +
    `**50% — Needs: ₹${Math.round(monthly * 0.50)}**\n` +
    `🏠 Rent & bills: ₹${Math.round(monthly * 0.30)}\n` +
    `🛒 Groceries: ₹${Math.round(monthly * 0.10)}\n` +
    `🚗 Transport: ₹${Math.round(monthly * 0.10)}\n\n` +
    `**30% — Wants: ₹${Math.round(monthly * 0.30)}**\n` +
    `🍕 Dining out: ₹${Math.round(monthly * 0.15)}\n` +
    `🎉 Entertainment: ₹${Math.round(monthly * 0.10)}\n` +
    `🛍️ Shopping: ₹${Math.round(monthly * 0.05)}\n\n` +
    `**20% — Savings: ₹${Math.round(monthly * 0.20)}**\n` +
    `🏦 Emergency fund: ₹${Math.round(monthly * 0.10)}\n` +
    `💸 Investments: ₹${Math.round(monthly * 0.10)}\n\n` +
    `💡 Tip: If over budget in Wants, cut Fun first — Needs should always come first!`;
}

function giveSavingsTips(stats) {
  const topCat = stats.categoryData[0];
  const saving = topCat ? Math.round(topCat.value * 0.2) : 0;
  return `💸 **Smart Savings Tips for You**\n\n` +
    `1️⃣ **Track every rupee** — You're already doing this with Splitter! Awareness = savings.\n\n` +
    `2️⃣ **Split more expenses** — Use Splitter for every shared expense. Even ₹100 split 4 ways saves you ₹75.\n\n` +
    (topCat ? `3️⃣ **Target ${topCat.name}** — Cutting it by 20% saves you ₹${saving}/month = ₹${saving * 12}/year! 🎯\n\n` : "") +
    `4️⃣ **48-hour rule** — Wait 48 hours before any non-essential group expense.\n\n` +
    `5️⃣ **Settle fast** — Money owed to you is money you can't invest. Chase payments weekly.\n\n` +
    `6️⃣ **SIP with savings** — Put your monthly savings into a mutual fund SIP for long-term growth.\n\n` +
    `7️⃣ **3-month emergency fund** — Keep 3 months of expenses in a savings account before investing.`;
}

function getHealthScore(stats) {
  let score = 70;
  const issues = [], positives = [];
  const total = parseFloat(stats.total) || 0;
  const topCat = stats.categoryData[0];
  const topPct = topCat && total > 0 ? Math.round((topCat.value / total) * 100) : 0;
  const settleRate = (stats.settled + stats.pending) > 0 ? Math.round((stats.settled / (stats.settled + stats.pending)) * 100) : null;

  if (topPct > 60) { score -= 15; issues.push(`${topCat?.name} is ${topPct}% of spending`); }
  else if (topPct <= 40 && total > 0) { score += 10; positives.push("well-diversified spending"); }
  if (stats.pending > 5) { score -= 15; issues.push(`${stats.pending} unsettled expenses`); }
  else if (stats.pending === 0 && total > 0) { score += 10; positives.push("all expenses settled"); }
  if (settleRate !== null && settleRate < 50) { score -= 15; issues.push(`low settlement rate (${settleRate}%)`); }
  else if (settleRate !== null && settleRate >= 80) { score += 10; positives.push(`excellent settlement rate (${settleRate}%)`); }
  if (stats.categoryData.length >= 4) { score += 5; positives.push("tracking multiple categories"); }
  if (stats.friendCount > 0) { score += 5; positives.push("actively splitting expenses"); }
  score = Math.min(100, Math.max(0, score));
  return { score, issues, positives };
}

function getScoreColor(s) { return s >= 80 ? "#0EA875" : s >= 60 ? "#D4960A" : "#E05555"; }
function getScoreLabel(s) { return s >= 80 ? "Excellent 🌟" : s >= 60 ? "Good 👍" : s >= 40 ? "Fair ⚡" : "Needs Work 💪"; }

function getAutoInsights(stats) {
  const total = parseFloat(stats.total) || 0;
  if (total === 0) return [];
  const insights = [];
  const topCat = stats.categoryData[0];
  const topPct = topCat ? Math.round((topCat.value / total) * 100) : 0;
  const settleRate = (stats.settled + stats.pending) > 0 ? Math.round((stats.settled / (stats.settled + stats.pending)) * 100) : null;
  const monthly = stats.monthlyData;

  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1]?.amount || 0;
    const prev = monthly[monthly.length - 2]?.amount || 0;
    const change = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
    if (change > 20) insights.push({ type: "warning", icon: "📈", title: `Spending up ${change}% this month`, msg: `Your expenses rose from ₹${prev} to ₹${last}. Review what changed this month.` });
    else if (change < -10) insights.push({ type: "good", icon: "📉", title: `Spending down ${Math.abs(change)}%`, msg: `Great improvement! You spent ₹${prev - last} less than last month.` });
  }
  if (topPct > 60) insights.push({ type: "warning", icon: "⚠️", title: `${topCat?.name} is ${topPct}% of budget`, msg: `This is too concentrated. A healthy budget has no single category above 40%.` });
  if (settleRate !== null && settleRate < 50) insights.push({ type: "warning", icon: "💸", title: `Low settlement rate (${settleRate}%)`, msg: "More than half your expenses are unsettled. Set a weekly reminder to chase payments." });
  else if (settleRate !== null && settleRate >= 90) insights.push({ type: "good", icon: "🎯", title: `${settleRate}% settled — outstanding!`, msg: "You have excellent financial discipline. Keep maintaining this habit!" });
  if (stats.pending > 5) insights.push({ type: "warning", icon: "⏳", title: `${stats.pending} expenses pending`, msg: "Too many open debts. Settle older ones first to keep your finances clean." });
  if (stats.categoryData.length >= 4 && topPct < 40) insights.push({ type: "good", icon: "✅", title: "Balanced spending pattern", msg: "Your expenses are well spread across categories — a sign of healthy financial habits!" });
  return insights;
}

export default function AIInsights() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hi! 👋 I'm your Splitter AI Financial Advisor.\n\nI can help you with:\n💰 Spending analysis\n📊 Financial health score\n💡 Personalised advice\n🎯 Budget planning\n❓ Splitter app questions\n\nWhat would you like today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, settled: 0, categoryData: [], monthlyData: [], friendCount: 0 });
  const [activeTab, setActiveTab] = useState("chat");
  const [thinking, setThinking] = useState(false);
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
      const catMap = {};
      exps.forEach(e => {
        const cat = (e.category || "Other").split(" ").slice(1).join(" ") || e.category || "Other";
        catMap[cat] = (catMap[cat] || 0) + e.amount / e.memberIds.length;
      });
      const categoryData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(0)), color: COLORS[i] }));
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
      setStats({ total: total.toFixed(0), pending, settled, categoryData, monthlyData, friendCount: fsnap.size });
    }
    load();
  }, [user]);

  function findAnswer(q) {
    const text = q.toLowerCase();
    // App questions
    for (const item of SPLITTER_QA) {
      if (item.keys.some(k => text.includes(k))) return item.a;
    }
    // Financial topics
    if (text.includes("analys") || text.includes("how am i doing") || text.includes("spending habit") || text.includes("my spending")) return analyseSpending(stats, user.displayName);
    if (text.includes("advice") || text.includes("suggest") || text.includes("improve") || text.includes("what should")) return giveAdvice(stats);
    if (text.includes("budget")) return giveBudgetAdvice(stats);
    if (text.includes("save") || text.includes("saving") || text.includes("cut cost")) return giveSavingsTips(stats);
    if (text.includes("score") || text.includes("health")) {
      const { score, issues, positives } = getHealthScore(stats);
      return `📈 **Your Financial Health Score: ${score}/100**\n${getScoreLabel(score)}\n\n` +
        (positives.length ? `✅ Strengths:\n${positives.map(p => `• ${p}`).join("\n")}\n\n` : "") +
        (issues.length ? `⚠️ Needs work:\n${issues.map(i => `• ${i}`).join("\n")}\n\n` : "") +
        `💡 Ask "give me advice" to fix these issues!`;
    }
    if (text.includes("total") || text.includes("spent")) return `💰 You've spent ₹${stats.total} total across all expenses.\n\n${parseFloat(stats.total) > 0 ? 'Ask me "analyse my spending" for a full breakdown!' : "Start adding expenses to track your finances!"}`;
    if (text.includes("pending") || text.includes("unsettled")) return `⏳ You have ${stats.pending} pending expense${stats.pending !== 1 ? "s" : ""}.\n\n${stats.pending > 3 ? "That's quite a few — settle them soon to keep finances clean!" : stats.pending === 0 ? "🎉 All clear! Excellent settlement discipline!" : "Almost there, settle them soon!"}`;
    if (text.includes("hello") || text.includes("hi") || text.includes("hey")) return `Hello ${user.displayName?.split(" ")[0]}! 😊\n\nWhat can I help you with today?\n• Type "analyse my spending"\n• Type "give me advice"\n• Type "budget tips"\n• Or ask any app question!`;
    if (text.includes("thank")) return "You're welcome! 😊 Keep tracking expenses for better financial health! 💪";
    if (text.includes("good") || text.includes("bad") || text.includes("how is")) return analyseSpending(stats, user.displayName);
    return `I can help with:\n\n💰 **Financial:**\n• "Analyse my spending"\n• "Give me advice"\n• "Budget tips"\n• "How to save money"\n• "My health score"\n\n❓ **App questions:**\n• "How to add expense"\n• "How to settle"\n• "How to add friends"\n\nWhat would you like? 😊`;
  }

  function send(text) {
    const msg = text || input;
    if (!msg.trim() || thinking) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setThinking(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "ai", text: findAnswer(msg) }]);
      setThinking(false);
    }, 600);
  }

  const { score, issues, positives } = getHealthScore(stats);
  const autoInsights = getAutoInsights(stats);

  const QUICK = [
    { label: "📊 Analyse spending", msg: "analyse my spending" },
    { label: "💡 Give me advice", msg: "give me financial advice" },
    { label: "💰 Budget plan", msg: "budget tips" },
    { label: "💸 Saving tips", msg: "how to save money" },
    { label: "🏆 My score", msg: "what is my health score" },
    { label: "❓ App help", msg: "how to add an expense" },
  ];

  return (
    <div className="page-content">
      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { label: "Total Spent", value: `₹${parseFloat(stats.total).toLocaleString("en-IN")}`, color: "#2563EB", icon: "💸" },
          { label: "Pending", value: stats.pending, color: stats.pending > 0 ? "#E05555" : "#0EA875", icon: "⏳" },
          { label: "Settled", value: stats.settled, color: "#0EA875", icon: "✅" },
          { label: "Health Score", value: `${score}/100`, color: getScoreColor(score), icon: "📈" },
        ].map((s, i) => (
          <div className="stat-card" key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {[{ id: "chat", label: "💬 AI Advisor" }, { id: "insights", label: "📊 Insights" }, { id: "score", label: "🏆 Score" }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
            fontFamily: "var(--font-b)", fontSize: 13, fontWeight: 500, transition: "all 0.15s",
            background: activeTab === t.id ? "var(--surface)" : "transparent",
            color: activeTab === t.id ? "var(--accent)" : "var(--muted)",
            boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
          }}>{t.label}</button>
        ))}
      </div>

      {/* AI Chat */}
      {activeTab === "chat" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #0EA875, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "white", flexShrink: 0 }}>✦</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Splitter AI Financial Advisor</div>
              <div style={{ fontSize: 11, color: "#0EA875" }}>● Online — analyses your real spending data</div>
            </div>
          </div>

          <div className="ai-messages" style={{ flex: 1, maxHeight: 340, overflowY: "auto" }}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === "ai" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #0EA875, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "white", flexShrink: 0 }}>✦</div>
                )}
                <div className="msg-bubble" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.text}</div>
              </div>
            ))}
            {thinking && (
              <div className="msg ai">
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #0EA875, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "white", flexShrink: 0 }}>✦</div>
                <div className="msg-bubble"><div className="typing"><div className="dot" /><div className="dot" /><div className="dot" /></div></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0 8px" }}>
            {QUICK.map((s, i) => (
              <button key={i} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => send(s.msg)}>{s.label}</button>
            ))}
          </div>

          <div className="ai-input-row">
            <input className="ai-input" placeholder="Ask for financial advice or app help..."
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()} />
            <button className="btn btn-primary" onClick={() => send()} disabled={thinking}>Send ↑</button>
          </div>
        </div>
      )}

      {/* Insights */}
      {activeTab === "insights" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {autoInsights.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>AI-Generated Insights</div>
              {autoInsights.map((ins, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12,
                  background: ins.type === "good" ? "#0EA87508" : "#E0555508",
                  border: `1px solid ${ins.type === "good" ? "#0EA87530" : "#E0555530"}`
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{ins.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{ins.title}</div>
                    <div style={{ fontSize: 13, color: "#5A6080", lineHeight: 1.5 }}>{ins.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card">
              <div className="card-title">Spending by Category</div>
              {stats.categoryData.length === 0
                ? <div style={{ textAlign: "center", padding: "30px 0", color: "#8891AA", fontSize: 13 }}>No data yet</div>
                : <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <PieChart width={120} height={120}>
                    <Pie data={stats.categoryData} cx={55} cy={55} innerRadius={32} outerRadius={55} dataKey="value" paddingAngle={3}>
                      {stats.categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {stats.categoryData.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: "#8891AA" }}>{c.name}</span>
                        <span style={{ fontWeight: 600 }}>₹{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              }
            </div>
            <div className="card">
              <div className="card-title">Monthly Trend</div>
              {stats.monthlyData.length === 0
                ? <div style={{ textAlign: "center", padding: "30px 0", color: "#8891AA", fontSize: 13 }}>No data yet</div>
                : <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={stats.monthlyData}>
                    <XAxis dataKey="month" tick={{ fill: "#8891AA", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E6EF", borderRadius: 8, fontSize: 12 }} formatter={v => `₹${v}`} />
                    <Bar dataKey="amount" fill="#2563EB" radius={[4, 4, 0, 0]} name="Spent" />
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
          </div>
          <div className="card">
            <div className="card-title">Summary Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                { label: "Top Category", value: stats.categoryData[0]?.name || "N/A", sub: `₹${stats.categoryData[0]?.value || 0}`, color: "#0EA875" },
                { label: "Settlement Rate", value: (stats.settled + stats.pending) > 0 ? `${Math.round((stats.settled / (stats.settled + stats.pending)) * 100)}%` : "N/A", sub: `${stats.settled}/${stats.settled + stats.pending} done`, color: "#2563EB" },
                { label: "Avg per Expense", value: (stats.settled + stats.pending) > 0 ? `₹${Math.round(parseFloat(stats.total) / (stats.settled + stats.pending))}` : "N/A", sub: "per transaction", color: "#D4960A" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center", padding: 14, background: "var(--surface2)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: "#8891AA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#8891AA", marginTop: 4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Score */}
      {activeTab === "score" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 13, color: "#8891AA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Financial Health Score</div>
            <div style={{ position: "relative", width: 150, height: 150, margin: "0 auto 20px" }}>
              <svg viewBox="0 0 150 150">
                <circle cx="75" cy="75" r="64" fill="none" stroke="#E2E6EF" strokeWidth="12" />
                <circle cx="75" cy="75" r="64" fill="none" stroke={getScoreColor(score)} strokeWidth="12"
                  strokeDasharray={`${(score / 100) * 402} 402`} strokeLinecap="round"
                  transform="rotate(-90 75 75)" style={{ transition: "stroke-dasharray 1s ease" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 36, fontWeight: 800, color: getScoreColor(score), lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 12, color: "#8891AA" }}>out of 100</div>
              </div>
            </div>
            <div style={{ fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 700, color: getScoreColor(score), marginBottom: 8 }}>{getScoreLabel(score)}</div>
            <div style={{ fontSize: 13, color: "#8891AA", maxWidth: 320, margin: "0 auto" }}>Score based on spending diversity, settlement rate, pending expenses and category balance</div>
          </div>

          {positives.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ color: "#0EA875" }}>✅ What you're doing well</div>
              {positives.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < positives.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: "#0EA87520", color: "#0EA875", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>✓</div>
                  <span style={{ fontSize: 14, textTransform: "capitalize" }}>{p}</span>
                </div>
              ))}
            </div>
          )}

          {issues.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ color: "#E05555" }}>⚠️ Areas to improve</div>
              {issues.map((issue, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < issues.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: "#E0555520", color: "#E05555", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>!</div>
                  <span style={{ fontSize: 14, textTransform: "capitalize" }}>{issue}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ background: "linear-gradient(135deg,#0EA87508,#2563EB08)", border: "1px solid #0EA87525" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>💡 How to improve your score</div>
            <div style={{ fontSize: 13, color: "#5A6080", lineHeight: 2 }}>
              • Settle all pending expenses on time ✓<br />
              • Spread spending across 4+ categories ✓<br />
              • Maintain settlement rate above 80% ✓<br />
              • Add all expenses immediately after paying ✓<br />
              • Keep no single category above 40% of budget ✓
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
