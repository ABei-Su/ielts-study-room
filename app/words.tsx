"use client";
import { useState, useRef, useEffect } from "react";
import {
  BookmarkPlus,
  Volume2,
  Plus,
  Search,
  Check,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { vocabulary } from "@/lib/catalog";
import type { StudyRecord, WordData } from "@/lib/types";
import type { Persist } from "./use-records";
import { useNow } from "./use-now";
type WordInput = {
  word: string;
  meaning: string;
  example: string;
  source: string;
};
const pendingCollections = new Map<
  string,
  { record: StudyRecord; event: string }
>();
export async function wordId(word: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(word.toLowerCase().trim()),
  );
  return (
    "w:" +
    Array.from(new Uint8Array(bytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
export async function collectWord(
  word: WordInput,
  records: StudyRecord[],
  persist: Persist,
) {
  const id = await wordId(word.word);
  const existing = records.find((r) => r.id === id);
  if (existing) {
    pendingCollections.delete(id);
    return existing;
  }
  const op = pendingCollections.get(id) ?? {
    record: {
      id,
      kind: "word" as const,
      revision: 0,
      updated: 0,
      data: { ...word, stage: 0, due: 0, reviews: 0 },
    },
    event: crypto.randomUUID(),
  };
  pendingCollections.set(id, op);
  const result = await persist(op.record, "save", undefined, op.event);
  pendingCollections.delete(id);
  return result;
}
function speak(word: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(word);
  speech.lang = "en-GB";
  speech.rate = 0.85;
  window.speechSynthesis.speak(speech);
}
export function WordDialog({
  open,
  onOpenChange,
  records,
  persist,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: StudyRecord[];
  persist: Persist;
}) {
  const [word, setWord] = useState(""),
    [meaning, setMeaning] = useState(""),
    [example, setExample] = useState(""),
    [source, setSource] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>记下这个生词</DialogTitle>
          <DialogDescription>
            添加释义和例句，稍后在生词本中复习。
          </DialogDescription>
        </DialogHeader>
        <form
          className="word-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await collectWord(
                {
                  word: word.trim(),
                  meaning: meaning.trim(),
                  example,
                  source: source.trim() || "个人收藏",
                },
                records,
                persist,
              );
              setWord("");
              setMeaning("");
              setExample("");
              setSource("");
              onOpenChange(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "收藏失败");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            教材 / 章节 / 页码（选填）
            <input
              maxLength={120}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="例如 IELTS Trainer 1 · Test 1 · p.12"
            />
          </label>
          <label>
            英文单词或短语
            <input
              required
              maxLength={80}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="例如 sustainable"
            />
          </label>
          <label>
            中文释义
            <input
              required
              maxLength={500}
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="例如 adj. 可持续的"
            />
          </label>
          <label>
            例句或上下文（可选）
            <textarea
              maxLength={1000}
              value={example}
              onChange={(e) => setExample(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="incorrect">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "保存中…" : "收藏并加入复习"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function WordBook({
  records,
  onAdd,
}: {
  records: StudyRecord[];
  onAdd: () => void;
}) {
  const now = useNow();
  const [query, setQuery] = useState("");
  const words = records.filter((r) => r.kind === "word");
  const filtered = words.filter((r) =>
    JSON.stringify(r.data).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="row toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            aria-label="搜索生词"
            placeholder="搜索单词或释义"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="button" onClick={onAdd}>
          <Plus size={17} /> 添加生词
        </button>
      </div>
      {words.length === 0 ? (
        <div className="empty-state">
          <BookmarkPlus size={36} />
          <h2>把第一次遇见，留给下一次记住。</h2>
          <p>从练习中记下生词，或在“单词学习”中收藏主题词汇。</p>
          <button className="button" onClick={onAdd}>
            添加第一个生词
          </button>
        </div>
      ) : (
        <>
          <p className="muted mb-5">
            {words.length} 个生词 ·{" "}
            {words.filter((r) => (r.data as WordData).due <= now).length}{" "}
            个到期可复习
          </p>
          <div className="word-grid">
            {filtered.map((r) => {
              const w = r.data as WordData;
              return (
                <article className="word-item" key={r.id}>
                  <div className="row justify-between">
                    <h3>{w.word}</h3>
                    <button
                      className="text-button"
                      aria-label={"朗读 " + w.word}
                      onClick={() => speak(w.word)}
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                  <p>{w.meaning}</p>
                  <blockquote>{w.example}</blockquote>
                  <p className="muted text-sm">来源：{w.source}</p>
                  <div className="card-bottom">
                    <span>{w.reviews} 次复习</span>
                    <span>
                      {w.due <= now
                        ? "待复习"
                        : `下次 ${new Date(w.due).toLocaleDateString("zh-CN")}`}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          {!filtered.length && <p className="empty-state">没有匹配的生词。</p>}
        </>
      )}
    </>
  );
}
export function WordLearning({
  records,
  persist,
  enabled,
}: {
  records: StudyRecord[];
  persist: Persist;
  enabled: boolean;
}) {
  const [mode, setMode] = useState("review"),
    [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(() => Date.now());
  const attempt = useRef<{
    record: StudyRecord;
    rating: string;
    event: string;
  } | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearInterval(timer);
      window.speechSynthesis?.cancel();
    };
  }, []);
  const due = records.filter(
    (r) => r.kind === "word" && (r.data as WordData).due <= now,
  );
  const current =
    mode === "review"
      ? (due[0]?.data as WordData | undefined)
      : vocabulary[index % vocabulary.length];
  async function rate(rating: string) {
    if (!due[0]) return;
    setBusy(true);
    setError("");
    const op = attempt.current ?? {
      record: due[0],
      rating,
      event: crypto.randomUUID(),
    };
    attempt.current = op;
    try {
      await persist(op.record, "review", op.rating, op.event);
      attempt.current = null;
      setNow(Date.now());
      setRevealed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Tabs
      value={mode}
      onValueChange={(v) => {
        if (busy) return;
        setMode(v);
        setRevealed(false);
        setError("");
      }}
    >
      <TabsList className="learning-tabs">
        <TabsTrigger value="review">
          复习生词 <span className="count">{due.length}</span>
        </TabsTrigger>
        <TabsTrigger value="new">学习新词</TabsTrigger>
      </TabsList>
      <TabsContent value={mode}>
        <p className="muted mt-5">
          {mode === "review"
            ? "先回忆释义，再翻面。根据真实记忆情况，安排下次复习。"
            : "24 个学术主题词 · 释义与例句为学习辅助内容，不是官方题目。"}
        </p>
        {current ? (
          <>
            <div className="flash-card">
              <div className="row justify-between">
                <span className="eyebrow">
                  {mode === "review"
                    ? "SPACED REPETITION"
                    : "ACADEMIC VOCABULARY"}
                </span>
                <span className="muted">
                  {mode === "review"
                    ? `${due.length} 个待复习`
                    : `${(index % vocabulary.length) + 1} / ${vocabulary.length}`}
                </span>
              </div>
              <button
                className="sound-button"
                aria-label="朗读单词"
                onClick={() => speak(current.word)}
              >
                <Volume2 size={20} />
              </button>
              <h2>{current.word}</h2>
              <p className="word-topic">{current.source}</p>
              {revealed ? (
                <div className="word-reveal">
                  <h3>{current.meaning}</h3>
                  <p>{current.example}</p>
                </div>
              ) : (
                <button
                  className="reveal-button"
                  onClick={() => setRevealed(true)}
                >
                  想一想，再查看释义 <ArrowRight size={16} />
                </button>
              )}
            </div>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="review-actions">
              {mode === "review" ? (
                <>
                  <button
                    className="button secondary"
                    disabled={!revealed || busy}
                    onClick={() => void rate("again")}
                  >
                    <RotateCcw size={16} /> 没记住 · 10分钟
                  </button>
                  <button
                    className="button secondary"
                    disabled={!revealed || busy}
                    onClick={() => void rate("familiar")}
                  >
                    有印象
                  </button>
                  <button
                    className="button"
                    disabled={!revealed || busy}
                    onClick={() => void rate("remembered")}
                  >
                    <Check size={16} /> 记住了
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button secondary"
                    disabled={busy || !enabled}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await collectWord(current, records, persist);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "收藏失败");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {records.some(
                      (r) =>
                        r.kind === "word" &&
                        (r.data as WordData).word === current.word,
                    ) ? (
                      <>
                        <Check size={16} /> 已收藏
                      </>
                    ) : (
                      <>
                        <BookmarkPlus size={16} /> 加入生词本
                      </>
                    )}
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      setIndex(index + 1);
                      setRevealed(false);
                      setError("");
                    }}
                  >
                    下一个 <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
            <p className="center muted mt-5">
              朗读使用浏览器语音，音色取决于设备。复习安排仅作学习辅助。
            </p>
          </>
        ) : (
          <div className="empty-state">
            <Check size={40} />
            <h2>当前没有到期的生词</h2>
            <p>可以学习新词，也可以到生词本添加练习中遇见的词。</p>
            <button className="button" onClick={() => setMode("new")}>
              学习新词 <ArrowRight size={16} />
            </button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
