import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BookOpen, LockKeyhole, ArrowRight } from "lucide-react";
import StudyShell from "../app/study-shell";
import "../app/globals.css";
import "./theme.css";

type User = { id: string; username: string };
function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function session() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/session", {
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 401) {
        setUser(null);
        return;
      }
      const b = (await r.json()) as { error?: string; user: User };
      if (!r.ok) throw new Error(b.error ?? "暂时无法连接");
      setUser(b.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败，请重试");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(session);
  }, []);
  if (loading)
    return (
      <main className="login-page">
        <p role="status">正在打开自习室…</p>
      </main>
    );
  if (user)
    return (
      <StudyShell
        signedIn
        userKey={user.id}
        onLogout={async () => {
          const r = await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            signal: AbortSignal.timeout(15000),
          });
          if (!r.ok) throw new Error("退出失败，请重试");
          setUser(null);
        }}
      />
    );
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <BookOpen size={26} /> IELTS 自习室
        </div>
        <div>
          <span className="login-kicker">ACADEMIC</span>
          <h1>
            给学习，
            <br />
            一个专注的空间。
          </h1>
          <p>听力 · 阅读 · 写作 · 单词</p>
        </div>
        <small>你的练习、草稿和生词，随时接着学。</small>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <span className="login-icon">
            <LockKeyhole size={23} />
          </span>
          <h2>欢迎回来</h2>
          <p className="login-subtitle">登录你的个人自习室</p>
          <form
            className="word-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: form.get("username"),
                    password: form.get("password"),
                    remember: form.get("remember") === "on",
                  }),
                  signal: AbortSignal.timeout(15000),
                });
                const b = (await r.json()) as { error?: string; user: User };
                if (!r.ok) throw new Error(b.error);
                setUser(b.user);
              } catch (e) {
                setError(e instanceof Error ? e.message : "登录失败，请重试");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              账号
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={40}
                placeholder="输入账号"
                disabled={busy}
              />
            </label>
            <label>
              密码
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
                placeholder="输入密码"
                disabled={busy}
              />
            </label>
            <label className="remember">
              <input
                name="remember"
                type="checkbox"
                defaultChecked
                disabled={busy}
              />{" "}
              保持登录 30 天
            </label>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <button className="button login-submit" disabled={busy}>
              {busy ? "正在登录…" : "进入自习室"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="login-foot">仅供个人使用 · 无需 ChatGPT 账号</p>
        </div>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
