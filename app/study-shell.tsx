"use client";
import { useState, useRef, useEffect } from "react";
import {
  BookOpen,
  Headphones,
  PenLine,
  LayoutDashboard,
  Bookmark,
  Layers,
  ShieldCheck,
  Cloud,
  GraduationCap,
  History,
  Download,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { exercises, type Exercise } from "@/lib/catalog";
import type { StudyRecord, SessionData } from "@/lib/types";
import { useRecords, downloadText } from "./use-records";
import Overview from "./overview";
import Books from "./books";
import Practice, { ExerciseList } from "./practice";
import { WordDialog, WordBook, WordLearning } from "./words";
const nav = [
  { id: "home", label: "学习概览", icon: LayoutDashboard },
  { id: "listening", label: "听力练习", icon: Headphones },
  { id: "reading", label: "阅读练习", icon: BookOpen },
  { id: "writing", label: "写作练习", icon: PenLine },
  { id: "words", label: "我的生词本", icon: Bookmark },
  { id: "learn", label: "单词学习", icon: Layers },
  { id: "books", label: "我的教材", icon: BookOpen },
  { id: "history", label: "学习记录", icon: History },
];
function Navigation({
  view,
  navigate,
}: {
  view: string;
  navigate: (view: string) => Promise<void>;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {nav.map((n) => (
        <SidebarMenuItem key={n.id}>
          <SidebarMenuButton
            isActive={view === n.id}
            onClick={async () => {
              await navigate(n.id);
              setOpenMobile(false);
            }}
          >
            <n.icon />
            <span>{n.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
export default function StudyShell({
  signedIn,
  userKey,
  onLogout,
}: {
  signedIn: boolean;
  userKey: string;
  onLogout?: () => Promise<void>;
}) {
  const [view, setView] = useState("home"),
    [active, setActive] = useState<StudyRecord | null>(null),
    [wordOpen, setWordOpen] = useState(false);
  const guard = useRef<null | (() => Promise<boolean>)>(null);
  const store = useRecords(signedIn);
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false),
    [startError, setStartError] = useState("");
  const enabled = signedIn && !store.loading && !store.error && !starting;
  async function navigate(next: string) {
    if (guard.current && !(await guard.current())) return;
    setActive(null);
    setView(next);
    window.scrollTo({ top: 0 });
  }
  async function start(exercise: Exercise, record?: StudyRecord) {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError("");
    try {
      const session =
        record ??
        (await store.persist({
          id: crypto.randomUUID(),
          kind: "session",
          revision: 0,
          updated: 0,
          data: {
            exerciseId: exercise.id,
            status: "draft",
            answers: exercise.answers.map(() => ""),
            essay: "",
            notes: "",
            elapsed: 0,
            audioTime: 0,
          },
        }));
      setView(exercise.kind);
      setActive(session);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "无法开始练习，请重试");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }
  function resume(record: StudyRecord) {
    const exercise = exercises.find(
      (e) => e.id === (record.data as SessionData).exerciseId,
    );
    if (exercise) start(exercise, record);
  }
  // Agent actions are deliberately read-only; all mutations use the same authenticated UI/API.
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "read_ielts_study_summary",
            description:
              "Read counts of saved personal IELTS practice and vocabulary records.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error("Expected an empty object");
              return {
                loading: store.loading,
                available: enabled,
                sessions: store.records.filter((r) => r.kind === "session")
                  .length,
                words: store.records.filter((r) => r.kind === "word").length,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [store.records, store.loading, enabled]);
  return (
    <SidebarProvider>
      <Sidebar className="study-sidebar">
        <SidebarHeader>
          <button className="brand" onClick={() => void navigate("home")}>
            <span className="brand-symbol">i.</span>
            <span>
              IELTS 自习室<small>YOUR PERSONAL STUDY SPACE</small>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <div className="side-label">我的学习空间</div>
          <Navigation view={view} navigate={navigate} />
          <div className="side-note">
            <GraduationCap size={24} />
            <strong>Academic 学术类</strong>
            <p>
              每一次练习，
              <br />
              都是下一步的积累。
            </p>
          </div>
        </SidebarContent>
        <SidebarFooter>
          {onLogout && (
            <button
              className="logout-button"
              onClick={async () => {
                if (guard.current && !(await guard.current())) return;
                try {
                  await onLogout();
                } catch (e) {
                  setStartError(e instanceof Error ? e.message : "退出失败");
                }
              }}
            >
              退出登录
            </button>
          )}
          <div className="personal">
            <span className="avatar">ME</span>
            <div>
              我的自习室
              <small>
                <ShieldCheck size={12} /> 仅自己可见
              </small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <span>
              学习空间{" "}
              <span className="crumb">
                / {nav.find((n) => n.id === view)?.label}
              </span>
            </span>
          </div>
          <span className="cloud-label">
            <Cloud size={16} />
            {store.loading
              ? "读取记录中…"
              : store.error
                ? "云端暂不可用"
                : signedIn
                  ? "个人云端记录"
                  : "登录后保存进度"}
          </span>
        </header>
        <main className="main-content">
          {!signedIn && (
            <div className="notice">
              登录后即可保存练习、作文和生词。
              <a
                className="button small"
                href="/signin-with-chatgpt?return_to=/"
                target="_top"
              >
                登录我的自习室
              </a>
            </div>
          )}
          {store.error && (
            <div className="notice error" role="alert">
              <span>{store.error}</span>
              <button
                className="button small"
                onClick={() => void store.reload()}
              >
                重新读取
              </button>
            </div>
          )}
          {startError && (
            <div className="notice error" role="alert">
              {startError} 请恢复网络后重新开始。
            </div>
          )}
          {active ? (
            <Practice
              key={active.id}
              record={active}
              persist={store.persist}
              guard={guard}
              onBack={() => void navigate(view)}
              onCollect={() => setWordOpen(true)}
              userKey={userKey}
            />
          ) : view === "home" ? (
            <Overview
              records={store.records}
              navigate={(v) => void navigate(v)}
              onResume={resume}
              loading={store.loading}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">IELTS ACADEMIC / YOUR STUDY SPACE</p>
                  <h1>{nav.find((n) => n.id === view)?.label}</h1>
                  <p>
                    {view === "history"
                      ? "接续未完成的练习，回顾每一次进步。"
                      : view === "words"
                        ? "每一个收藏的词，都有下一次相遇。"
                        : view === "learn"
                          ? "在回忆中巩固，在语境中积累。"
                          : "真实来源，专注练习。"}
                  </p>
                </div>
              </div>
              {["listening", "reading", "writing"].includes(view) && (
                <ExerciseList
                  kind={view}
                  records={store.records}
                  onStart={start}
                  enabled={Boolean(enabled)}
                />
              )}
              {view === "words" && (
                <WordBook
                  records={store.records}
                  onAdd={() => setWordOpen(true)}
                />
              )}
              {view === "books" && (
                <Books
                  enabled={Boolean(enabled)}
                  onCollect={() => setWordOpen(true)}
                />
              )}
              {view === "learn" && (
                <WordLearning
                  records={store.records}
                  persist={store.persist}
                  enabled={Boolean(enabled)}
                />
              )}
              {view === "history" && (
                <>
                  <div className="row toolbar">
                    <p className="muted">
                      作文、答案、笔记和复习记录保存在当前账户中。
                    </p>
                    <button
                      disabled={!enabled}
                      className="button secondary"
                      onClick={() =>
                        downloadText(
                          "IELTS-学习记录.json",
                          JSON.stringify(
                            {
                              version: 1,
                              exportedAt: new Date().toISOString(),
                              records: store.records,
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      <Download size={16} /> 导出全部记录
                    </button>
                  </div>
                  {store.records.filter((r) => r.kind === "session").length ===
                  0 ? (
                    <div className="empty-state">
                      <History size={36} />
                      <h2>还没有学习记录</h2>
                      <p>开始一次练习，答案和草稿会出现在这里。</p>
                      <button
                        className="button"
                        onClick={() => void navigate("reading")}
                      >
                        开始阅读练习
                      </button>
                    </div>
                  ) : (
                    <div className="history-list">
                      {store.records
                        .filter((r) => r.kind === "session")
                        .map((r) => {
                          const s = r.data as SessionData,
                            e = exercises.find((e) => e.id === s.exerciseId);
                          return (
                            <button
                              className="history-item"
                              key={r.id}
                              onClick={() => resume(r)}
                            >
                              <div>
                                <strong>{e?.title}</strong>
                                <p>
                                  {e?.type} ·{" "}
                                  {new Date(r.updated).toLocaleString("zh-CN")}
                                </p>
                              </div>
                              <span className="tag">
                                {s.status === "draft"
                                  ? "继续草稿"
                                  : e?.kind === "writing"
                                    ? "作文已归档"
                                    : `${s.score} / ${e?.answers.length} 正确`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <footer>
            IELTS 自习室{" "}
            <span>独立个人学习工具 · 官方样题不等同于历年真题</span>
          </footer>
        </main>
      </SidebarInset>
      <WordDialog
        open={wordOpen}
        onOpenChange={setWordOpen}
        records={store.records}
        persist={store.persist}
      />
    </SidebarProvider>
  );
}
