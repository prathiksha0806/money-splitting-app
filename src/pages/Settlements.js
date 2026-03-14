import { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, addDoc,
  serverTimestamp, updateDoc, deleteDoc, doc
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";

function simplifyDebts(balances) {
  const creditors = balances.filter(b => b.amount > 0.01).sort((a, b) => b.amount - a.amount);
  const debtors = balances.filter(b => b.amount < -0.01).sort((a, b) => a.amount - b.amount);
  const txns = [];
  const c = creditors.map(x => ({ ...x }));
  const d = debtors.map(x => ({ ...x }));
  let i = 0, j = 0;
  while (i < c.length && j < d.length) {
    const amount = Math.min(c[i].amount, -d[j].amount);
    if (amount > 0.01) txns.push({
      from: d[j].name, fromId: d[j].uid,
      to: c[i].name, toId: c[i].uid,
      amount: parseFloat(amount.toFixed(2))
    });
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
  const [history, setHistory] = useState([]);
  const [recordingId, setRecordingId] = useState(null);
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    if (!user) return;
    // Get ALL expenses (not just unsettled) to calculate balances properly
    const eq = query(
      collection(db, "expenses"),
      where("memberIds", "array-contains", user.uid)
    );
    const unsub1 = onSnapshot(eq, snap =>
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const sq = query(
      collection(db, "settlements"),
      where("involvedIds", "array-contains", user.uid)
    );
    const unsub2 = onSnapshot(sq, snap =>
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.settledAt?.seconds || 0) - (a.settledAt?.seconds || 0)))
    );
    return () => { unsub1(); unsub2(); };
  }, [user]);

  // Build balance map — respect per-member settlements
  const balanceMap = {};
  expenses.forEach(exp => {
    if (exp.settled) return; // skip fully settled
    const share = exp.amount / exp.memberIds.length;
    const settledMembers = exp.settledMembers || [];
    exp.memberIds.forEach((uid, idx) => {
      if (!balanceMap[uid]) balanceMap[uid] = { uid, name: exp.memberNames?.[idx] || uid, amount: 0 };
      if (uid === exp.paidById) {
        // Count only members who haven't settled yet
        const unsettledCount = exp.memberIds.filter(id => id !== exp.paidById && !settledMembers.includes(id)).length;
        balanceMap[uid].amount += share * unsettledCount;
      } else if (!settledMembers.includes(uid)) {
        balanceMap[uid].amount -= share;
      }
    });
  });

  const balances = Object.values(balanceMap);
  const simplified = simplifyDebts(balances);
  const iOwe = simplified.filter(s => s.fromId === user.uid);
  const owesMe = simplified.filter(s => s.toId === user.uid);
  const others = simplified.filter(s => s.fromId !== user.uid && s.toId !== user.uid);
  const myBalance = balanceMap[user.uid]?.amount || 0;

  async function recordPayment(txn) {
    const key = txn.fromId + txn.toId;
    setRecordingId(key);
    try {
      // Save to history
      await addDoc(collection(db, "settlements"), {
        fromId: txn.fromId,
        fromName: txn.from,
        toId: txn.toId,
        toName: txn.to,
        amount: txn.amount,
        involvedIds: [txn.fromId, txn.toId],
        settledAt: serverTimestamp(),
      });

      // Mark the payer as settled in each shared expense
      const related = expenses.filter(e =>
        !e.settled &&
        e.memberIds.includes(txn.fromId) &&
        e.memberIds.includes(txn.toId)
      );

      for (const exp of related) {
        const settledMembers = exp.settledMembers || [];
        // The debtor (fromId) has paid
        const updatedSettled = [...new Set([...settledMembers, txn.fromId])];
        // Check if all non-payer members have settled
        const nonPayers = exp.memberIds.filter(id => id !== exp.paidById);
        const allSettled = nonPayers.every(id => updatedSettled.includes(id));
        await updateDoc(doc(db, "expenses", exp.id), {
          settledMembers: updatedSettled,
          settled: allSettled,
        });
      }
    } catch (e) { console.error(e); }
    setRecordingId(null);
  }

  async function deleteHistory(id) {
    await deleteDoc(doc(db, "settlements", id));
  }

  async function clearAllHistory() {
    if (!window.confirm("Clear all settlement history?")) return;
    for (const s of history) await deleteDoc(doc(db, "settlements", s.id));
  }

  return (
    <div className="page-content">
      {/* Top summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <div className="stat-card" style={{ textAlign: "center" }}>
          <div className="stat-label">You're Owed</div>
          <div className="stat-value" style={{ color: "#0EA875", fontSize: 22 }}>
            ₹{owesMe.reduce((s, t) => s + t.amount, 0).toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: "#8891AA" }}>{owesMe.length} {owesMe.length === 1 ? "person" : "people"}</div>
        </div>
        <div className="stat-card" style={{ textAlign: "center" }}>
          <div className="stat-label">You Owe</div>
          <div className="stat-value" style={{ color: iOwe.length > 0 ? "#E05555" : "#0EA875", fontSize: 22 }}>
            ₹{iOwe.reduce((s, t) => s + t.amount, 0).toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: "#8891AA" }}>{iOwe.length} {iOwe.length === 1 ? "person" : "people"}</div>
        </div>
        <div className="stat-card" style={{ textAlign: "center" }}>
          <div className="stat-label">Net Balance</div>
          <div className="stat-value" style={{ color: myBalance >= 0 ? "#0EA875" : "#E05555", fontSize: 22 }}>
            {myBalance >= 0 ? "+" : ""}₹{Math.abs(myBalance).toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: "#8891AA" }}>{myBalance >= 0 ? "You're ahead" : "You owe overall"}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {["pending", "history", "balances"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer",
              fontFamily: "var(--font-b)", fontSize: 13, fontWeight: 500, transition: "all 0.15s",
              background: tab === t ? "var(--surface)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--muted)",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none"
            }}>
            {t === "pending" ? `Pending (${simplified.length})` : t === "history" ? `History (${history.length})` : "Balances"}
          </button>
        ))}
      </div>

      {/* Pending */}
      {tab === "pending" && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 4 }}>Pending Settlements</div>
          <div style={{ fontSize: 12, color: "#8891AA", marginBottom: 16 }}>Minimum transactions to clear all debts</div>

          {simplified.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>All Settled Up!</div>
              <div style={{ color: "#8891AA", fontSize: 13 }}>No pending payments</div>
            </div>
          ) : (
            <>
              {owesMe.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0EA875", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    💚 People who owe you
                  </div>
                  {owesMe.map((s, i) => (
                    <SettlementRow key={i} txn={s} user={user}
                      recording={recordingId === s.fromId + s.toId}
                      onRecord={() => recordPayment(s)} />
                  ))}
                </div>
              )}
              {iOwe.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E05555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    ❤️ You owe these people
                  </div>
                  {iOwe.map((s, i) => (
                    <SettlementRow key={i} txn={s} user={user}
                      recording={recordingId === s.fromId + s.toId}
                      onRecord={() => recordPayment(s)} isDebt />
                  ))}
                </div>
              )}
              {others.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8891AA", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    Between others
                  </div>
                  {others.map((s, i) => (
                    <SettlementRow key={i} txn={s} user={user} recording={false} onRecord={() => recordPayment(s)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Settlement History</div>
            {history.length > 0 && (
              <button className="btn btn-sm"
                style={{ background: "#E0555510", color: "#E05555", border: "1px solid #E0555530" }}
                onClick={clearAllHistory}>Clear All</button>
            )}
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#8891AA", fontSize: 14 }}>
              No settlements recorded yet
            </div>
          ) : history.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#0EA87515", color: "#0EA875", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.fromName} paid {s.toName}</div>
                <div style={{ fontSize: 12, color: "#8891AA" }}>
                  {s.settledAt?.toDate ? s.settledAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recently"}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: "#0EA875", fontSize: 16 }}>₹{s.amount}</div>
              <span style={{ background: "#0EA87515", color: "#0EA875", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Done</span>
              <button onClick={() => deleteHistory(s.id)}
                style={{ background: "#E0555510", color: "#E05555", border: "1px solid #E0555330", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Balances */}
      {tab === "balances" && (
        <div className="card">
          <div className="card-title">Everyone's Balance</div>
          {balances.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#8891AA", fontSize: 14 }}>No active expenses</div>
          ) : balances.map((b, i) => {
            const max = Math.max(...balances.map(x => Math.abs(x.amount))) || 1;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: b.amount >= 0 ? "#0EA87515" : "#E0555515", color: b.amount >= 0 ? "#0EA875" : "#E05555", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {b.name?.[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, width: 110, flexShrink: 0 }}>{b.uid === user.uid ? "You" : b.name}</span>
                <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(Math.abs(b.amount) / max) * 100}%`, height: "100%", background: b.amount >= 0 ? "#0EA875" : "#E05555", borderRadius: 4, transition: "width 0.4s" }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: b.amount >= 0 ? "#0EA875" : "#E05555", minWidth: 80, textAlign: "right" }}>
                  {b.amount >= 0 ? "+" : ""}₹{Math.abs(b.amount).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettlementRow({ txn, user, recording, onRecord, isDebt }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
      background: "var(--surface2)", borderRadius: 12, marginBottom: 10,
      border: `1px solid ${isDebt ? "#E0555520" : "#0EA87520"}`
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: isDebt ? "#0EA87520" : "#E0555520", color: isDebt ? "#0EA875" : "#E05555", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
        {isDebt ? txn.to?.[0]?.toUpperCase() : txn.from?.[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {txn.from === user.displayName ? "You" : txn.from}
          <span style={{ color: "#8891AA", fontWeight: 400 }}> → </span>
          {txn.to === user.displayName ? "You" : txn.to}
        </div>
        <div style={{ fontSize: 12, color: "#8891AA", marginTop: 2 }}>
          {isDebt ? "You need to pay" : "Waiting for payment"}
        </div>
      </div>
      <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 18, color: isDebt ? "#E05555" : "#0EA875" }}>
        ₹{txn.amount}
      </div>
      <button onClick={onRecord} disabled={recording}
        style={{
          padding: "8px 16px", borderRadius: 9, border: "none", cursor: recording ? "not-allowed" : "pointer",
          background: isDebt ? "#E05555" : "#0EA875", color: "white",
          fontWeight: 600, fontSize: 13, opacity: recording ? 0.6 : 1, flexShrink: 0
        }}>
        {recording ? "..." : isDebt ? "I Paid" : "✓ Received"}
      </button>
    </div>
  );
}
