import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "./Dashboard";

function simplifyDebts(balances) {
  const creditors = balances.filter(b => b.amount > 0.01).sort((a, b) => b.amount - a.amount);
  const debtors = balances.filter(b => b.amount < -0.01).sort((a, b) => a.amount - b.amount);
  const txns = [];
  let i = 0, j = 0;
  const c = creditors.map(x => ({ ...x }));
  const d = debtors.map(x => ({ ...x }));
  while (i < c.length && j < d.length) {
    const amount = Math.min(c[i].amount, -d[j].amount);
    if (amount > 0.01) txns.push({ from: d[j].name, fromId: d[j].uid, to: c[i].name, toId: c[i].uid, amount: parseFloat(amount.toFixed(2)) });
    c[i].amount -= amount;
    d[j].amount += amount;
    if (Math.abs(c[i].amount) < 0.01) i++;
    if (Math.abs(d[j].amount) < 0.01) j++;
  }
  return txns;
}

export default function Settlements() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!user) return;
    const eq = query(collection(db, "expenses"), where("memberIds", "array-contains", user.uid), where("settled", "==", false));
    const unsub1 = onSnapshot(eq, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const sq = query(collection(db, "settlements"), where("involvedIds", "array-contains", user.uid));
    const unsub2 = onSnapshot(sq, snap => setSettlements(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Calculate net balances per person
  const balanceMap = {};
  expenses.forEach(exp => {
    const share = exp.amount / exp.memberIds.length;
    exp.memberIds.forEach((uid, idx) => {
      if (!balanceMap[uid]) balanceMap[uid] = { uid, name: exp.memberNames?.[idx] || uid, amount: 0 };
      if (uid === exp.paidById) {
        balanceMap[uid].amount += exp.amount - share;
      } else {
        balanceMap[uid].amount -= share;
      }
    });
  });
  const balances = Object.values(balanceMap);
  const simplified = simplifyDebts(balances);

  async function recordPayment(txn) {
  setRecording(true);
  try {
    await addDoc(collection(db, "settlements"), {
      fromId: txn.fromId,
      fromName: txn.from,
      toId: txn.toId,
      toName: txn.to,
      amount: txn.amount,
      involvedIds: [txn.fromId, txn.toId],
      settledAt: serverTimestamp(),
    });
    // Only mark expenses between these two specific people as settled
    const relatedExpenses = expenses.filter(e =>
      e.memberIds.includes(txn.fromId) && 
      e.memberIds.includes(txn.toId) &&
      e.memberIds.length === 2
    );
    for (const exp of relatedExpenses) {
      await updateDoc(doc(db, "expenses", exp.id), { settled: true });
    }
  } catch (e) { console.error(e); }
  setRecording(false);
}

  return (
    <div className="page-content">
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card">
          <div className="card-title">✦ Smart Settlements</div>
          <p style={{ fontSize: 12, color: "#8891AA", marginBottom: 14 }}>Minimum transactions to clear all debts</p>
          {simplified.length === 0
            ? <EmptyState text="All settled up! 🎉" />
            : simplified.map((s, i) => (
              <div className="settlement-card" key={i}>
                <div className="settle-person from">
                  <div className="settle-avatar red">{s.from?.[0]}</div>
                  <span>{s.from === user.displayName ? "You" : s.from}</span>
                </div>
                <div className="settle-arrow">
                  <div className="arrow-amount">₹{s.amount}</div>
                  <div className="arrow-line" />
                </div>
                <div className="settle-person to">
                  <div className="settle-avatar green">{s.to?.[0]}</div>
                  <span>{s.to === user.displayName ? "You" : s.to}</span>
                </div>
                {(s.fromId === user.uid || s.toId === user.uid) && (
                  <button className="btn btn-primary btn-sm" disabled={recording} onClick={() => recordPayment(s)}>
                    {recording ? "..." : "Record"}
                  </button>
                )}
              </div>
            ))
          }
        </div>

        <div className="card">
          <div className="card-title">Settlement History</div>
          {settlements.length === 0
            ? <EmptyState text="No settlements recorded yet." />
            : settlements.sort((a, b) => (b.settledAt?.seconds || 0) - (a.settledAt?.seconds || 0)).map(s => (
              <div className="expense-item" key={s.id}>
                <div className="expense-icon">✓</div>
                <div className="expense-meta">
                  <div className="expense-name">{s.fromName} → {s.toName}</div>
                  <div className="expense-detail">
                    {s.settledAt?.toDate ? s.settledAt.toDate().toLocaleDateString("en-IN") : "Recently"}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: "#0EA875" }}>₹{s.amount}</div>
                <span className="tag tag-settled">Done</span>
              </div>
            ))
          }
        </div>
      </div>

      <div className="card">
        <div className="card-title">Your Balance</div>
        {balances.length === 0
          ? <EmptyState text="No active expenses." />
          : balances.map((b, i) => {
            const max = Math.max(...balances.map(x => Math.abs(x.amount))) || 1;
            return (
              <div className="balance-row" key={i}>
                <div className="bal-avatar">{b.name?.[0]?.toUpperCase()}</div>
                <span style={{ fontSize: 13, width: 110, flexShrink: 0 }}>{b.uid === user.uid ? "You" : b.name}</span>
                <div className="balance-bar-wrap">
                  <div className="balance-bar" style={{ width: `${(Math.abs(b.amount) / max) * 100}%`, background: b.amount >= 0 ? "#0EA875" : "#E05555" }} />
                </div>
                <span className="balance-amount" style={{ color: b.amount >= 0 ? "#0EA875" : "#E05555" }}>
                  {b.amount >= 0 ? "+" : ""}₹{Math.abs(b.amount).toFixed(2)}
                </span>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
