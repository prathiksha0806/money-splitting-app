import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#0EA875", "#2563EB", "#D4960A", "#E05555", "#7C3AED"];


export default function Dashboard() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({ owed: 0, owes: 0 });

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "expenses"),
      where("memberIds", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setExpenses(data);

      let owed = 0, owes = 0;
      data.forEach(exp => {
        if (exp.settled) return;
        const share = exp.amount / exp.memberIds.length;
        if (exp.paidById === user.uid) {
          owed += exp.amount - share;
        } else {
          owes += share;
        }
      });
      setBalances({ owed: parseFloat(owed.toFixed(2)), owes: parseFloat(owes.toFixed(2)) });
    });
    return unsub;
  }, [user]);

  // Monthly data
  const monthlyMap = {};
  expenses.forEach(exp => {
    if (!exp.createdAt) return;
    const d = exp.createdAt.toDate ? exp.createdAt.toDate() : new Date(exp.createdAt);
    const key = d.toLocaleString("default", { month: "short" });
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, spending: 0, settled: 0 };
    monthlyMap[key].spending += exp.amount / exp.memberIds.length;
    if (exp.settled) monthlyMap[key].settled += exp.amount / exp.memberIds.length;
  });
  const monthlyData = Object.values(monthlyMap).slice(-6);

  // Category data
  const catMap = {};
  expenses.forEach(exp => {
    const cat = exp.category?.split(" ").slice(1).join(" ") || "Other";
    catMap[cat] = (catMap[cat] || 0) + exp.amount / exp.memberIds.length;
  });
  const categoryData = Object.entries(catMap).map(([name, value], i) => ({ name, value: parseFloat(value.toFixed(2)), color: COLORS[i % COLORS.length] }));

  const recent = expenses.slice(0, 5);
  const totalSpent = expenses.reduce((s, e) => s + e.amount / e.memberIds.length, 0);

  return (
    <div className="page-content">
      <div className="stats-grid">
        {[
          { label: "You're Owed", value: `₹${balances.owed}`, color: "#0EA875" },
          { label: "You Owe", value: `₹${balances.owes}`, color: balances.owes > 0 ? "#E05555" : "#0EA875" },
          { label: "Total Spent", value: `₹${totalSpent.toFixed(0)}`, color: "#2563EB" },
          { label: "Active Expenses", value: expenses.filter(e => !e.settled).length, color: "#D4960A" },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Monthly Activity</div>
          {monthlyData.length === 0 ? <EmptyState text="No expenses yet" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} barGap={4}>
                <XAxis dataKey="month" tick={{ fill: "#8891AA", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E6EF", borderRadius: 8 }} formatter={v => `₹${v.toFixed(0)}`} />
                <Bar dataKey="spending" fill="#2563EB" radius={[4,4,0,0]} name="Your Share" />
                <Bar dataKey="settled" fill="#0EA875" radius={[4,4,0,0]} name="Settled" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <div className="card-title">By Category</div>
          {categoryData.length === 0 ? <EmptyState text="No data yet" /> : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <PieChart width={130} height={130}>
                <Pie data={categoryData} cx={60} cy={60} innerRadius={36} outerRadius={60} dataKey="value" paddingAngle={3}>
                  {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                {categoryData.map((c, i) => (
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
      </div>

      <div className="card">
        <div className="card-title">Recent Expenses</div>
        {recent.length === 0 ? <EmptyState text="No expenses yet. Add your first one!" /> : recent.map(e => (
          <ExpenseRow key={e.id} expense={e} userId={user.uid} />
        ))}
      </div>
    </div>
  );
}

export function ExpenseRow({ expense: e, userId }) {
  const share = (e.amount / e.memberIds.length).toFixed(2);
  const isPayer = e.paidById === userId;
  return (
    <div className="expense-item">
      <div className="expense-icon">{e.category?.split(" ")[0] || "💸"}</div>
      <div className="expense-meta">
        <div className="expense-name">{e.desc}</div>
        <div className="expense-detail">
          Paid by {isPayer ? "You" : e.paidByName} · {e.memberIds.length} people · {e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString("en-IN") : ""}
        </div>
      </div>
      <div className="expense-amount">
        <div className="expense-total" style={{ color: isPayer ? "#0EA875" : "#E05555" }}>
          {isPayer ? "+" : "-"}₹{share}
        </div>
        <div className="expense-share">Total: ₹{e.amount}</div>
      </div>
      <span className={`tag ${e.settled ? "tag-settled" : "tag-pending"}`}>
        {e.settled ? "✓ Settled" : "Pending"}
      </span>
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0", color: "#8891AA", fontSize: 14 }}>
      {text}
    </div>
  );
}
