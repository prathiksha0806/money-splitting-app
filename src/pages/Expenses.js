import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot, addDoc,
  serverTimestamp, doc, updateDoc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";
import { ExpenseRow, EmptyState } from "./Dashboard";

const CATEGORIES = ["🍕 Food", "🏠 Rent", "🚗 Travel", "🎉 Fun", "🛒 Groceries", "💡 Utilities", "🎬 Entertainment"];

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "expenses"),
      where("memberIds", "array-contains", user.uid),
      
    );
    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setExpenses(data);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "friends"), where("userId", "==", user.uid));
    return onSnapshot(q, snap => setFriends(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  const filtered = filter === "all" ? expenses : expenses.filter(e => e.settled === (filter === "settled"));

  async function markSettled(expenseId) {
    await updateDoc(doc(db, "expenses", expenseId), { settled: true });
  }

  return (
    <div className="page-content">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "pending", "settled"].map(f => (
            <button key={f} className="btn btn-secondary btn-sm"
              onClick={() => setFilter(f)}
              style={filter === f ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowModal(true)}>
          + Add Expense
        </button>
      </div>

      <div className="card">
        {filtered.length === 0
          ? <EmptyState text={filter === "all" ? "No expenses yet. Add your first!" : `No ${filter} expenses.`} />
          : filtered.map(e => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
              <div className="expense-icon">{e.category?.split(" ")[0] || "💸"}</div>
              <div className="expense-meta" style={{ flex: 1 }}>
                <div className="expense-name">{e.desc}</div>
                <div className="expense-detail">
                  Paid by {e.paidById === user.uid ? "You" : e.paidByName} · {e.memberIds.length} people · {e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString("en-IN") : ""}
                </div>
              </div>
              <div className="expense-amount" style={{ textAlign: "right" }}>
                <div className="expense-total" style={{ color: e.paidById === user.uid ? "#0EA875" : "#E05555" }}>
                  {e.paidById === user.uid ? "+" : "-"}₹{(e.amount / e.memberIds.length).toFixed(2)}
                </div>
                <div className="expense-share">Total: ₹{e.amount}</div>
              </div>
              <span className={`tag ${e.settled ? "tag-settled" : "tag-pending"}`}>
                {e.settled ? "✓ Settled" : "Pending"}
              </span>
              {!e.settled && e.paidById === user.uid && (
                <button className="btn btn-sm" style={{ background: "#0EA87515", color: "#0EA875", border: "1px solid #0EA87544", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}
                  onClick={() => markSettled(e.id)}>
                  Mark Settled
                </button>
              )}
            </div>
          ))
        }
      </div>

      {showModal && <AddExpenseModal onClose={() => setShowModal(false)} user={user} friends={friends} />}
    </div>
  );
}

function AddExpenseModal({ onClose, user, friends }) {
  const [form, setForm] = useState({ desc: "", amount: "", category: CATEGORIES[0], splitType: "equal" });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [percentages, setPercentages] = useState({});
  const [exactAmounts, setExactAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleMember = (f) => setSelectedMembers(prev =>
    prev.find(m => m.uid === f.uid) ? prev.filter(m => m.uid !== f.uid) : [...prev, f]
  );

  async function handleSave() {
    if (!form.desc.trim()) { setError("Please enter a description"); return; }
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0) { setError("Enter a valid amount"); return; }

    setLoading(true);
    try {
      const allMembers = [{ uid: user.uid, name: user.displayName || "You" }, ...selectedMembers];
      const memberIds = allMembers.map(m => m.uid);
      const memberNames = allMembers.map(m => m.name);

      let splits = {};
      const amt = parseFloat(form.amount);
      if (form.splitType === "equal") {
        const share = parseFloat((amt / allMembers.length).toFixed(2));
        allMembers.forEach(m => splits[m.uid] = share);
      } else if (form.splitType === "percentage") {
        allMembers.forEach(m => {
          const pct = parseFloat(percentages[m.uid] || (100 / allMembers.length));
          splits[m.uid] = parseFloat(((pct / 100) * amt).toFixed(2));
        });
      } else {
        allMembers.forEach(m => { splits[m.uid] = parseFloat(exactAmounts[m.uid] || 0); });
      }

      await addDoc(collection(db, "expenses"), {
        desc: form.desc,
        amount: amt,
        category: form.category,
        splitType: form.splitType,
        splits,
        paidById: user.uid,
        paidByName: user.displayName || "You",
        memberIds,
        memberNames,
        settled: false,
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      setError("Failed to save. Try again.");
    }
    setLoading(false);
  }

  const allMembers = [{ uid: user.uid, name: user.displayName || "You" }, ...selectedMembers];
  const totalPeople = allMembers.length;
  const amt = parseFloat(form.amount) || 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Add Expense</div>
        <div className="form-stack">
          <div className="form-group">
            <label className="label">Description</label>
            <input className="input" placeholder="e.g. Dinner at hotel" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Amount (₹)</label>
              <input className="input" type="number" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {friends.length > 0 && (
            <div className="form-group">
              <label className="label">Split With</label>
              <div className="member-grid">
                {friends.map(f => (
                  <div key={f.friendId}
                    className={`member-check ${selectedMembers.find(m => m.uid === f.friendId) ? "selected" : ""}`}
                    onClick={() => toggleMember({ uid: f.friendId, name: f.friendName })}>
                    <div className="mini-avatar">{f.friendName?.[0]?.toUpperCase()}</div>
                    <span>{f.friendName?.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {friends.length === 0 && (
            <div className="info-box">Add friends first to split with them</div>
          )}

          <div className="form-group">
            <label className="label">Split Type</label>
            <div className="split-tabs">
              {["equal", "percentage", "exact"].map(t => (
                <div key={t} className={`split-tab ${form.splitType === t ? "active" : ""}`} onClick={() => setForm({ ...form, splitType: t })}>
                  {t === "equal" ? "⚖ Equal" : t === "percentage" ? "% Percent" : "# Exact"}
                </div>
              ))}
            </div>
          </div>

          {amt > 0 && (
            <div className="split-preview">
              {form.splitType === "equal" && (
                <span>Each of {totalPeople} people pays <strong style={{ color: "var(--accent)" }}>₹{(amt / totalPeople).toFixed(2)}</strong></span>
              )}
              {form.splitType === "percentage" && allMembers.map(m => (
                <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{m.name === user.displayName ? "You" : m.name}</span>
                  <input className="input" type="number" placeholder="%" style={{ width: 70, padding: "4px 8px" }}
                    value={percentages[m.uid] || ""} onChange={e => setPercentages({ ...percentages, [m.uid]: e.target.value })} />
                  <span style={{ fontSize: 12, color: "#8891AA", width: 60 }}>= ₹{((parseFloat(percentages[m.uid] || 0) / 100) * amt).toFixed(2)}</span>
                </div>
              ))}
              {form.splitType === "exact" && allMembers.map(m => (
                <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{m.name === user.displayName ? "You" : m.name}</span>
                  <input className="input" type="number" placeholder="₹0" style={{ width: 100, padding: "4px 8px" }}
                    value={exactAmounts[m.uid] || ""} onChange={e => setExactAmounts({ ...exactAmounts, [m.uid]: e.target.value })} />
                </div>
              ))}
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Add Expense"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
