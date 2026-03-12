import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return; }
        await register(form.email, form.password, form.name);
      }
    } catch (err) {
      const msgs = {
        "auth/user-not-found": "No account with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "Email already registered.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-email": "Invalid email address.",
        "auth/invalid-credential": "Invalid email or password.",
      };
      setError(msgs[err.code] || err.message);
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Split<span>ter</span></div>
        <p className="auth-sub">Split expenses with friends, simply.</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${isLogin ? "active" : ""}`} onClick={() => { setIsLogin(true); setError(""); }}>Sign In</button>
          <button className={`auth-tab ${!isLogin ? "active" : ""}`} onClick={() => { setIsLogin(false); setError(""); }}>Create Account</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label className="label">Full Name</label>
              <input className="input" type="text" placeholder="Your name" value={form.name} onChange={set("name")} required />
            </div>
          )}
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@email.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
