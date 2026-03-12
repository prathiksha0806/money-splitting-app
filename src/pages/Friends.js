import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../hooks/useAuth";
import { EmptyState } from "./Dashboard";

export default function Friends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "friends"), where("userId", "==", user.uid));
    return onSnapshot(q, snap => setFriends(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  async function searchUser() {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError("");
    try {
      const q = query(collection(db, "users"), where("email", "==", searchEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchError("No user found with that email.");
      } else {
        const found = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (found.uid === user.uid) { setSearchError("That's you!"); }
        else if (friends.find(f => f.friendId === found.uid)) { setSearchError("Already a friend."); }
        else { setSearchResult(found); }
      }
    } catch { setSearchError("Search failed. Try again."); }
    setSearching(false);
  }

  async function addFriend(friend) {
    setAdding(true);
    await addDoc(collection(db, "friends"), {
      userId: user.uid,
      userName: user.displayName,
      friendId: friend.uid,
      friendName: friend.name,
      friendEmail: friend.email,
      createdAt: serverTimestamp(),
    });
    // Add reverse too
    await addDoc(collection(db, "friends"), {
      userId: friend.uid,
      userName: friend.name,
      friendId: user.uid,
      friendName: user.displayName,
      friendEmail: user.email,
      createdAt: serverTimestamp(),
    });
    setSearchResult(null);
    setSearchEmail("");
    setAdding(false);
  }

  async function removeFriend(friendDoc) {
    await deleteDoc(doc(db, "friends", friendDoc.id));
  }

  return (
    <div className="page-content">
      <div className="card">
        <div className="card-title">Find a Friend</div>
        <p style={{ fontSize: 13, color: "#8891AA", marginBottom: 14 }}>Search by their Splitter email address to add them.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="input" style={{ flex: 1 }}
            placeholder="friend@email.com"
            value={searchEmail}
            onChange={e => { setSearchEmail(e.target.value); setSearchError(""); setSearchResult(null); }}
            onKeyDown={e => e.key === "Enter" && searchUser()}
          />
          <button className="btn btn-primary" onClick={searchUser} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {searchError && <div className="auth-error" style={{ marginTop: 10 }}>{searchError}</div>}

        {searchResult && (
          <div className="friend-result">
            <div className="friend-avatar">{searchResult.name?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{searchResult.name}</div>
              <div style={{ fontSize: 12, color: "#8891AA" }}>{searchResult.email}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => addFriend(searchResult)} disabled={adding}>
              {adding ? "Adding..." : "+ Add Friend"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">My Friends ({friends.length})</div>
        {friends.length === 0
          ? <EmptyState text="No friends yet. Search by email to add some!" />
          : friends.map(f => (
            <div className="friend-row" key={f.id}>
              <div className="friend-avatar">{f.friendName?.[0]?.toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.friendName}</div>
                <div style={{ fontSize: 12, color: "#8891AA" }}>{f.friendEmail}</div>
              </div>
              <button className="btn btn-sm" style={{ background: "#E0555510", color: "#E05555", border: "1px solid #E0555530" }}
                onClick={() => removeFriend(f)}>
                Remove
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
