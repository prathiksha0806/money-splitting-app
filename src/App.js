import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Friends from "./pages/Friends";
import Settlements from "./pages/Settlements";
import AIInsights from "./pages/AIInsights";

// ─── GLOBAL STYLES ────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #F4F6FB;
      --surface: #FFFFFF;
      --surface2: #F0F3FA;
      --border: #E3E8F0;
      --accent: #0EA875;
      --accent2: #2563EB;
      --accent3: #E05555;
      --text: #141928;
      --muted: #8896B0;
      --font-h: 'Syne', sans-serif;
      --font-b: 'DM Sans', sans-serif;
      --radius: 14px;
      --shadow: 0 2px 12px rgba(20,25,40,0.07);
    }

    html, body, #root { height: 100%; font-family: var(--font-b); background: var(--bg); color: var(--text); }

    /* ── Layout ── */
    .app-layout { display: flex; height: 100vh; overflow: hidden; }

    .sidebar {
      width: 230px; min-width: 230px; background: var(--surface);
      border-right: 1px solid var(--border); display: flex; flex-direction: column;
      padding: 24px 0; box-shadow: 2px 0 12px rgba(20,25,40,0.05);
      transition: transform 0.3s;
      z-index: 50;
    }
    .logo { padding: 0 22px 28px; font-family: var(--font-h); font-size: 24px; font-weight: 800; color: var(--text); }
    .logo span { color: var(--accent); }

    .nav-item {
      display: flex; align-items: center; gap: 12px; padding: 12px 22px;
      cursor: pointer; font-size: 14px; color: var(--muted); font-weight: 500;
      border-left: 3px solid transparent; transition: all 0.15s;
    }
    .nav-item:hover { color: var(--text); background: rgba(14,168,117,0.04); }
    .nav-item.active { color: var(--accent); border-left-color: var(--accent); background: rgba(14,168,117,0.06); }
    .nav-icon { font-size: 17px; width: 22px; text-align: center; }

    .sidebar-bottom { margin-top: auto; padding: 0 14px; }
    .user-pill {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      background: var(--surface2); border-radius: 12px;
    }
    .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #0EA875, #2563EB); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; flex-shrink: 0; }

    .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

    .topbar {
      background: var(--surface); border-bottom: 1px solid var(--border);
      padding: 16px 28px; display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .page-title { font-family: var(--font-h); font-size: 22px; font-weight: 700; }
    .page-sub { color: var(--muted); font-size: 13px; margin-top: 2px; }

    .page-content { padding: 24px 28px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 18px; }

    /* Hamburger for mobile */
    .hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; font-size: 22px; color: var(--text); }
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 40; }

    /* ── Cards ── */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); }
    .card-title { font-family: var(--font-h); font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }

    /* ── Grids ── */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    /* ── Stat Cards ── */
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); }
    .stat-label { font-size: 12px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.8px; }
    .stat-value { font-family: var(--font-h); font-size: 26px; font-weight: 700; margin: 6px 0 2px; }

    /* ── Buttons ── */
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 10px; border: none; cursor: pointer; font-family: var(--font-b); font-size: 14px; font-weight: 500; transition: all 0.15s; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: var(--accent); color: #fff; font-weight: 600; }
    .btn-primary:hover:not(:disabled) { background: #0c9a69; }
    .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
    .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }
    .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 8px; }

    /* ── Expense Items ── */
    .expense-item { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--border); position: relative; flex-wrap: wrap; }
    .expense-item:last-child { border-bottom: none; }
    .expense-icon { width: 38px; height: 38px; border-radius: 10px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
    .expense-meta { flex: 1; min-width: 120px; }
    .expense-name { font-size: 14px; font-weight: 500; }
    .expense-detail { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .expense-amount { text-align: right; }
    .expense-total { font-size: 15px; font-weight: 600; }
    .expense-share { font-size: 12px; color: var(--muted); }
    .tag { display: inline-flex; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .tag-settled { background: rgba(14,168,117,0.1); color: var(--accent); }
    .tag-pending { background: rgba(224,85,85,0.1); color: var(--accent3); }

    /* ── Forms ── */
    .form-stack { display: flex; flex-direction: column; gap: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.8px; }
    .input { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; color: var(--text); font-family: var(--font-b); font-size: 14px; outline: none; transition: border-color 0.15s; width: 100%; }
    .input:focus { border-color: var(--accent); }
    .input::placeholder { color: var(--muted); }
    select.input { appearance: auto; }

    /* ── Split ── */
    .split-tabs { display: flex; background: var(--surface2); border-radius: 10px; padding: 3px; }
    .split-tab { flex: 1; padding: 8px; text-align: center; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--muted); transition: all 0.15s; }
    .split-tab.active { background: var(--surface); color: var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .split-preview { padding: 12px 14px; background: var(--surface2); border-radius: 10px; font-size: 13px; color: var(--muted); }
    .member-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .member-check { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; transition: all 0.15s; }
    .member-check.selected { border-color: var(--accent); background: rgba(14,168,117,0.05); color: var(--accent); }
    .mini-avatar { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #0EA875, #2563EB); color: white; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .info-box { background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.2); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: var(--accent2); }

    /* ── Auth ── */
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #f0f7f4 0%, #eef2fb 100%); padding: 20px; }
    .auth-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 36px; width: 100%; max-width: 420px; box-shadow: 0 8px 40px rgba(20,25,40,0.1); }
    .auth-logo { font-family: var(--font-h); font-size: 28px; font-weight: 800; text-align: center; margin-bottom: 6px; }
    .auth-logo span { color: var(--accent); }
    .auth-sub { text-align: center; color: var(--muted); font-size: 14px; margin-bottom: 24px; }
    .auth-tabs { display: flex; background: var(--surface2); border-radius: 12px; padding: 4px; gap: 4px; margin-bottom: 22px; }
    .auth-tab { flex: 1; padding: 9px; text-align: center; border-radius: 9px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--muted); background: none; border: none; transition: all 0.15s; font-family: var(--font-b); }
    .auth-tab.active { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .auth-form { display: flex; flex-direction: column; gap: 14px; }
    .auth-error { background: rgba(224,85,85,0.08); border: 1px solid rgba(224,85,85,0.25); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--accent3); }

    /* ── Friends ── */
    .friend-result { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 14px; background: var(--surface2); border-radius: 12px; border: 1px solid var(--border); }
    .friend-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
    .friend-row:last-child { border-bottom: none; }
    .friend-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #0EA875, #2563EB); color: white; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

    /* ── Settlements ── */
    .settlement-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface2); border-radius: 12px; border: 1px solid var(--border); margin-bottom: 10px; flex-wrap: wrap; }
    .settle-person { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; }
    .settle-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; }
    .settle-avatar.red { background: var(--accent3); }
    .settle-avatar.green { background: var(--accent); }
    .settle-arrow { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .arrow-amount { font-size: 13px; font-weight: 700; color: var(--accent); font-family: var(--font-h); }
    .arrow-line { width: 100%; height: 2px; background: linear-gradient(to right, #E05555, #0EA875); border-radius: 2px; position: relative; }
    .arrow-line::after { content: '▶'; position: absolute; right: -6px; top: -6px; color: #0EA875; font-size: 10px; }
    .balance-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .balance-row:last-child { border-bottom: none; }
    .bal-avatar { width: 28px; height: 28px; border-radius: 8px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text); flex-shrink: 0; }
    .balance-bar-wrap { flex: 1; height: 5px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .balance-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
    .balance-amount { font-size: 14px; font-weight: 600; min-width: 70px; text-align: right; }

    /* ── AI ── */
    .ai-card { display: flex; flex-direction: column; flex: 1; min-height: 500px; }
    .ai-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-bottom: 10px; max-height: 460px; }
    .msg { display: flex; gap: 10px; }
    .msg.user { flex-direction: row-reverse; }
    .msg-bubble { max-width: 82%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.6; }
    .msg.ai .msg-bubble { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
    .msg.user .msg-bubble { background: var(--accent); color: #fff; font-weight: 500; }
    .ai-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #0EA875, #2563EB); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0; }
    .ai-input-row { display: flex; gap: 8px; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border); }
    .ai-input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; color: var(--text); font-family: var(--font-b); font-size: 13px; outline: none; }
    .ai-input:focus { border-color: var(--accent); }
    .typing { display: flex; gap: 4px; align-items: center; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: bounce 1.2s infinite; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,60%,100% { transform:translateY(0) } 30% { transform:translateY(-6px) } }

    /* ── Modal ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(20,25,40,0.35); z-index: 100; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); padding: 16px; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(20,25,40,0.15); }
    .modal-title { font-family: var(--font-h); font-size: 20px; font-weight: 700; margin-bottom: 20px; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #D5DCEA; border-radius: 4px; }

    /* ── Logout btn ── */
    .logout-btn { background: none; border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: 12px; color: var(--muted); font-family: var(--font-b); transition: all 0.15s; }
    .logout-btn:hover { color: var(--accent3); border-color: var(--accent3); }

    /* ────────────── RESPONSIVE ────────────── */
    @media (max-width: 1024px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .hamburger { display: block; }
      .sidebar {
        position: fixed; top: 0; left: 0; height: 100vh;
        transform: translateX(-100%);
      }
      .sidebar.open { transform: translateX(0); }
      .sidebar-overlay { display: block; }
      .topbar { padding: 14px 16px; }
      .page-content { padding: 16px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .charts-grid { grid-template-columns: 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      .member-grid { grid-template-columns: repeat(2, 1fr); }
      .stat-value { font-size: 20px; }
    }

    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .expense-item { gap: 8px; }
      .settlement-card { flex-direction: column; align-items: flex-start; }
      .page-title { font-size: 18px; }
      .modal { padding: 20px; }
      .member-grid { grid-template-columns: 1fr 1fr; }
    }
  `}</style>
);

// ─── NAV CONFIG ──────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "expenses",  label: "Expenses",  icon: "⊟" },
  { id: "friends",   label: "Friends",   icon: "⬡" },
  { id: "settlements", label: "Settlements", icon: "⇌" },
  { id: "ai",        label: "AI Insights", icon: "✦" },
];

const PAGE_INFO = {
  dashboard:   { title: "Dashboard",    sub: "Your financial overview" },
  expenses:    { title: "Expenses",     sub: "Track all shared expenses" },
  friends:     { title: "Friends",      sub: "Manage your contacts" },
  settlements: { title: "Settlements",  sub: "AI-simplified debt resolution" },
  ai:          { title: "AI Insights",  sub: "Personalised spending analysis" },
};

const PAGES = {
  dashboard:   <Dashboard />,
  expenses:    <Expenses />,
  friends:     <Friends />,
  settlements: <Settlements />,
  ai:          <AIInsights />,
};

// ─── INNER APP (after auth) ──────────────────────────────────────
function AppInner() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function navigate(id) {
    setPage(id);
    setSidebarOpen(false);
  }

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="logo">Split<span>ter</span></div>
        {NAV.map(n => (
          <div key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => navigate(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="user-pill">
            <div className="user-avatar">{user?.displayName?.[0]?.toUpperCase() || "U"}</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.displayName || "User"}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button className="logout-btn" style={{ width: "100%", marginTop: 8 }} onClick={logout}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="main-area">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <div>
              <div className="page-title">{PAGE_INFO[page].title}</div>
              <div className="page-sub">{PAGE_INFO[page].sub}</div>
            </div>
          </div>
          {page !== "ai" && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate("expenses")}>
              + Add Expense
            </button>
          )}
        </div>
        {PAGES[page]}
      </div>
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────
function Root() {
  const { user } = useAuth();
  return user ? <AppInner /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <GlobalStyles />
      <Root />
    </AuthProvider>
  );
}
