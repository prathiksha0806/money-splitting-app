import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";

export default function AIInsights() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, pending: 0, topCat: "N/A" });

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

  const tips = [
    "💡 Split expenses immediately after paying to avoid forgetting.",
    "📊 Review your spending monthly to spot patterns.",
    "⚡ Settle debts weekly to keep friendships stress-free.",
    "🎯 Use exact splits for unequal expenses like food orders.",
    "📱 Share the app link with friends so everyone can track.",
    "💰 The person who pays most should be reimbursed first.",
    "🔄 Settle with one person at a time to avoid confusion.",
  ];

  return (
    <div className="page-content">
      <div className="stats-grid">
        {[
          { label: "Total Spent", value: `₹${stats.total}`, color: "#2563EB" },
          { label: "Pending Expenses", value: stats.pending, color: "#E05555" },
          { label: "Top Category", value: stats.topCat?.split(" ").slice(1).join(" ") || "N/A", color: "#0EA875" },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">💡 Smart Money Tips</div>
        {tips.map((tip, i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: i < tips.length - 1 ? "1px solid var(--border)" : "none", fontSize: 14, lineHeight: 1.6 }}>
            {tip}
          </div>
        ))}
      </div>
    </div>
  );
}