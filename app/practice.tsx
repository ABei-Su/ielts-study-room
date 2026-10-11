"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  Pause,
  Play,
  Download,
  CheckCircle2,
  Clock,
  BookmarkPlus,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exercises, officialSource, type Exercise } from "@/lib/catalog";
import type { StudyRecord, SessionData } from "@/lib/types";
import { wordCount } from "@/lib/domain.mjs";
import { exerciseProgress, matchesExercise } from "@/lib/study-view.mjs";
import { downloadText, type Persist } from "./use-records";
export function ExerciseList({
  kind,
  records,
  onStart,
  enabled,
}: {
  kind: string;
  records: StudyRecord[];
  onStart: (exercise: Exercise, record?: StudyRecord) => void;
  enabled: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [questionType, setQuestionType] = useState("all");
  const items = exercises
    .filter((e) => e.kind === kind)
    .map((e) => ({ e, ...exerciseProgress(records, e.id) }));
  const visible = items.filter(
    (item) =>
      (filter === "all" || item.state === filter) &&
      matchesExercise(item.e, query, questionType),
  );
  return (
    <>
      <div className="notice source-notice">
        <span>
          题库收录 <strong>IELTS 官方公开样题</strong>
          ，不是历年真题合集。原题由官方提供；本站保存你的答案和笔记。
        </span>
        <a href={officialSource} target="_blank" rel="noreferrer">
          核验来源 <ExternalLink size={14} />
        </a>
      </div>
      <div className="library-search">
        <label>
          搜索练习
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索主题、标题或题型…"
          />
        </label>
        <label>
          题型
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
          >
            <option value="all">全部题型</option>
            {[...new Set(items.map((item) => item.e.type))].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="library-filters" role="group" aria-label="按学习进度筛选">
        {[
          ["all", "全部练习"],
          ["draft", "继续学习"],
          ["new", "尚未开始"],
          ["completed", "已完成"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}{" "}
            <span>
              {
                items.filter((item) => value === "all" || item.state === value)
                  .length
              }
            </span>
          </button>
        ))}
      </div>
      <p className="muted" aria-live="polite">
        共 {visible.length} 组练习 · 选择一组，开始专注学习
      </p>
      <div className="exercise-grid study-library">
        {visible.map(({ e, draft, completed }) => {
          return (
            <article className="exercise-card" key={e.id}>
              <div className="row">
                <span className="tag">IELTS 官方样题</span>
                <span className="muted">
                  {e.minWords
                    ? `${e.minWords}+ 词`
                    : `${e.answers.length} 道题`}
                </span>
              </div>
              <h3>{e.title}</h3>
              <p>{e.subtitle}</p>
              <p className="exercise-detail">
                {e.type} · {e.minutes} 分钟
                {e.kind !== "writing" ? "（练习建议时长）" : ""}
              </p>
              <div className="card-bottom">
                <span>
                  {draft
                    ? "有未完成练习"
                    : completed
                      ? `已练习 ${completed} 次`
                      : "尚未开始"}
                </span>
                <button
                  disabled={!enabled}
                  className="button small"
                  onClick={() => onStart(e, draft)}
                >
                  {draft ? "继续练习" : "开始练习"}
                </button>
              </div>
            </article>
          );
        })}
        {visible.length === 0 && (
          <div className="library-empty">
            <p>没有符合条件的练习。</p>
            <button
              className="text-button"
              onClick={() => {
                setFilter("all");
                setQuery("");
                setQuestionType("all");
              }}
            >
              清除筛选，查看全部练习
            </button>
          </div>
        )}
      </div>
    </>
  );
}
type Props = {
  record: StudyRecord;
  persist: Persist;
  onBack: () => void;
  guard: React.MutableRefObject<null | (() => Promise<boolean>)>;
  onCollect: () => void;
  userKey: string;
};
export default function Practice({
  record,
  persist,
  onBack,
  guard,
  onCollect,
  userKey,
}: Props) {
  const exercise = exercises.find(
    (e) => e.id === (record.data as SessionData).exerciseId,
  )!;
  const [data, setData] = useState(record.data as SessionData),
    [status, setStatus] = useState(
      record.revision ? "已保存到云端" : "尚未保存",
    ),
    [error, setError] = useState(""),
    [running, setRunning] = useState(false),
    [preview, setPreview] = useState("task"),
    [audioError, setAudioError] = useState(false),
    [backup, setBackup] = useState("");
  const current = useRef(record),
    draft = useRef(data),
    dirty = useRef(false),
    locked = useRef(false),
    pending = useRef<Promise<boolean> | null>(null),
    failed = useRef<{
      record: StudyRecord;
      event: string;
      action: "save" | "submit";
    } | null>(null),
    audio = useRef<HTMLAudioElement>(null);
  const recoveryKey = `ielts-recovery-v1:${userKey}:${record.id}`;
  const [busy, setBusy] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [leaving, setLeaving] = useState(false);
  const completed = data.status === "submitted";
  const change = useCallback(
    (patch: Partial<SessionData>) => {
      if (locked.current) return;
      const next = { ...draft.current, ...patch };
      draft.current = next;
      dirty.current = true;
      setData(next);
      setStatus("待保存");
      try {
        localStorage.setItem(
          recoveryKey,
          JSON.stringify({ revision: current.current.revision, data: next }),
        );
      } catch {
        /* Cloud remains authoritative; export remains available. */
      }
    },
    [recoveryKey],
  );
  async function save(action: "save" | "submit" = "save"): Promise<boolean> {
    if (pending.current) {
      const result = await pending.current;
      if (!result) return false;
      return save(action);
    }
    if (
      draft.current.status === "submitted" ||
      (!dirty.current &&
        !failed.current &&
        action === "save" &&
        current.current.revision > 0)
    )
      return true;
    setBusy(true);
    if (action === "submit") {
      locked.current = true;
      setSubmitting(true);
      setRunning(false);
    }
    setStatus("保存中…");
    setError("");
    const task = (async () => {
      try {
        // Retry the same event before sending newer edits, including after an ambiguous timeout.
        if (failed.current) {
          const retry = failed.current;
          const saved = await persist(
            retry.record,
            retry.action,
            undefined,
            retry.event,
          );
          current.current = saved;
          failed.current = null;
          if (retry.action === "submit") {
            draft.current = saved.data as SessionData;
            setData(draft.current);
            dirty.current = false;
          }
        }
        if (draft.current.status !== "submitted") {
          const snapshot = draft.current;
          const payload = { ...current.current, data: snapshot };
          const event = crypto.randomUUID();
          failed.current = { record: payload, event, action };
          const saved = await persist(payload, action, undefined, event);
          failed.current = null;
          current.current = saved;
          if (snapshot === draft.current) {
            draft.current = saved.data as SessionData;
            setData(draft.current);
            dirty.current = false;
          }
        }
        setStatus(dirty.current ? "待保存" : "已保存到云端");
        try {
          if (!dirty.current) localStorage.removeItem(recoveryKey);
          else
            localStorage.setItem(
              recoveryKey,
              JSON.stringify({
                revision: current.current.revision,
                data: draft.current,
              }),
            );
        } catch {}
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "保存失败";
        if (/完成全部|输入不符合/.test(message)) {
          failed.current = null;
          locked.current = false;
        }
        setError(message);
        setStatus("未保存 · 请重试");
        return false;
      } finally {
        setBusy(false);
        setSubmitting(failed.current?.action === "submit");
        pending.current = null;
      }
    })();
    pending.current = task;
    return task;
  }
  // Refs let navigation flush the current draft without replacing the editor on every save.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    guard.current = async () => {
      const wasLocked = locked.current;
      locked.current = true;
      setLeaving(true);
      const ok = await saveRef.current();
      if (!ok) {
        locked.current = wasLocked;
        setLeaving(false);
      }
      return ok;
    };
    return () => {
      guard.current = null;
    };
  }, [guard]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const cached = localStorage.getItem(recoveryKey);
        if (cached) setBackup(cached);
      } catch {}
    });
    return () => cancelAnimationFrame(frame);
  }, [recoveryKey]);
  useEffect(() => {
    if (!dirty.current || busy || completed || error) return;
    const timer = setTimeout(() => void saveRef.current(), 1400);
    return () => clearTimeout(timer);
  }, [data, busy, completed, error]);
  useEffect(() => {
    if (!running || completed) return;
    const timer = setInterval(() => {
      if (!document.hidden)
        change({ elapsed: Math.min(86400, draft.current.elapsed + 1) });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, completed, change]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirty.current && !pending.current && !error) void saveRef.current();
    }, 10000);
    return () => clearInterval(timer);
  }, [error]);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirty.current || pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const filled = data.answers.filter((a) => a.trim()).length;
  const seconds = exercise.minutes * 60 - data.elapsed;
  const time = `${seconds < 0 ? "+" : ""}${Math.floor(Math.abs(seconds) / 60)
    .toString()
    .padStart(2, "0")}:${(Math.abs(seconds) % 60).toString().padStart(2, "0")}`;
  const exportDraft = () =>
    downloadText(
      `IELTS-${exercise.id}-${record.id}.txt`,
      `${exercise.title}\n${exercise.pdf}#page=${exercise.page}\n\n${data.essay || data.answers.map((a, i) => `${exercise.start + i}. ${a}`).join("\n")}\n\n笔记：\n${data.notes}`,
    );
  return (
    <>
      <div className="editor-heading">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={17} /> 返回题库
        </button>
        <span className="save-label" aria-live="polite">
          <CloudState status={status} />
          {status}
        </span>
      </div>
      <div className="page-heading">
        <div>
          <span className="tag">IELTS 官方样题</span>
          <h1 className="mt-3">{exercise.title}</h1>
          <p>
            {exercise.subtitle} · {exercise.type} · 原文第 {exercise.page} 页
          </p>
        </div>
        <div className="timer">
          <Clock size={18} />
          <strong>{time}</strong>
          <button
            aria-label={running ? "暂停计时" : "开始计时"}
            disabled={completed}
            onClick={() => setRunning(!running)}
          >
            {running ? <Pause size={17} /> : <Play size={17} />}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="notice error">
          <span>{error} 当前内容仍保留在此页。</span>
          <div className="row">
            <button className="button small secondary" onClick={exportDraft}>
              下载草稿
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() => void save()}
            >
              重试保存
            </button>
          </div>
        </div>
      )}
      {backup && (
        <div className="notice">
          <span>发现此设备上次未保存的内容。</span>
          <div className="row">
            <button
              className="button small secondary"
              onClick={() => downloadText("IELTS-恢复草稿.json", backup)}
            >
              下载备份
            </button>
            <button
              className="button small"
              onClick={() => {
                try {
                  const cached = JSON.parse(backup);
                  if (
                    cached.revision !== current.current.revision ||
                    completed
                  ) {
                    setError("云端记录已变化，请下载备份后手动合并。");
                    return;
                  }
                  change(cached.data);
                  setBackup("");
                } catch {
                  setError("备份格式损坏，请下载备份保留。");
                }
              }}
            >
              恢复到编辑区
            </button>
            <button className="text-button" onClick={() => setBackup("")}>
              稍后
            </button>
          </div>
        </div>
      )}
      {completed && (
        <div className="notice success">
          <CheckCircle2 size={22} />
          <span>
            {exercise.kind === "writing"
              ? "作文已归档，可查看官方范文与考官点评。本站不提供自动雅思评分。"
              : `本次答对 ${data.score} / ${exercise.answers.length} 题。下方可逐题查看结果。`}
          </span>
        </div>
      )}
      {exercise.audio && (
        <div className="audio-panel">
          <HeadphoneLabel />
          <audio
            ref={audio}
            controls
            preload="metadata"
            src={exercise.audio}
            onLoadedMetadata={() => {
              if (audio.current)
                audio.current.currentTime = Math.min(
                  data.audioTime,
                  audio.current.duration || 0,
                );
            }}
            onTimeUpdate={() => {
              if (
                !completed &&
                audio.current &&
                Math.abs(audio.current.currentTime - draft.current.audioTime) >
                  5
              )
                change({ audioTime: audio.current.currentTime });
            }}
            onError={() => setAudioError(true)}
          />
          <Select
            defaultValue="1"
            onValueChange={(v) => {
              if (audio.current) audio.current.playbackRate = Number(v);
            }}
          >
            <SelectTrigger aria-label="播放速度">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["0.75", "1", "1.25"].map((v) => (
                <SelectItem key={v} value={v}>
                  {v}×
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a href={exercise.audio} target="_blank" rel="noreferrer">
            {audioError ? "播放失败，打开原音频" : "原始音频"}{" "}
            <ExternalLink size={14} />
          </a>
        </div>
      )}
      <div className="workspace-grid">
        <section className="paper-panel">
          <Tabs value={preview} onValueChange={setPreview}>
            <div className="paper-toolbar">
              <TabsList>
                <TabsTrigger value="task">官方原题</TabsTrigger>
                <TabsTrigger value="key">
                  {exercise.kind === "writing" ? "范文与点评" : "参考答案"}
                </TabsTrigger>
                {exercise.transcriptPage && (
                  <TabsTrigger value="transcript">录音原文</TabsTrigger>
                )}
              </TabsList>
              <a
                href={
                  exercise.pdf +
                  `#page=${preview === "task" ? exercise.page : preview === "transcript" ? exercise.transcriptPage : exercise.keyPage}`
                }
                target="_blank"
                rel="noreferrer"
              >
                新窗口打开 <ExternalLink size={14} />
              </a>
            </div>
            <TabsContent value="task">
              <iframe
                title="官方原题 PDF"
                src={exercise.pdf + `#page=${exercise.page}&view=FitH`}
                className="paper-frame"
              />
            </TabsContent>
            <TabsContent value="key">
              <iframe
                title="官方参考答案 PDF"
                src={exercise.pdf + `#page=${exercise.keyPage}&view=FitH`}
                className="paper-frame"
              />
            </TabsContent>
            {exercise.transcriptPage && (
              <TabsContent value="transcript">
                <iframe
                  title="官方听力录音原文 PDF"
                  src={
                    exercise.pdf + `#page=${exercise.transcriptPage}&view=FitH`
                  }
                  className="paper-frame"
                />
              </TabsContent>
            )}
          </Tabs>
          <p className="paper-note">
            题面直接来自官方
            PDF。若浏览器不支持内嵌查看，请用上方“新窗口打开”。建议练习时停留在题目页，完成后再看答案。
          </p>
        </section>
        <section className="answer-panel">
          <div className="row justify-between">
            <h2>{exercise.kind === "writing" ? "我的作文" : "我的答案"}</h2>
            <button className="text-button" onClick={onCollect}>
              <BookmarkPlus size={16} /> 记生词
            </button>
          </div>
          {exercise.instruction && (
            <p className="answer-instruction">{exercise.instruction}</p>
          )}
          {exercise.kind === "writing" ? (
            <>
              <div className="writing-meta">
                <span>
                  {wordCount(data.essay)} / {exercise.minWords} 词
                </span>
                <span>建议 {exercise.minutes} 分钟</span>
              </div>
              <textarea
                className="essay"
                aria-label="我的作文"
                placeholder="Write your response here…"
                value={data.essay}
                maxLength={30000}
                readOnly={completed || submitting || leaving}
                onChange={(e) => change({ essay: e.target.value })}
              />
              <p className="muted">
                字数仅作练习参考；请对照官方评分维度复盘。
              </p>
              <details className="writing-checklist">
                <summary>写完后，做一次自查</summary>
                <ul>
                  <li>
                    {exercise.minWords === 150
                      ? "是否概括主要趋势或阶段，并选择关键数据作比较？"
                      : "是否回应题目的所有要求，并用解释和例子支持观点？"}
                  </li>
                  <li>段落是否围绕一个中心，衔接是否自然？</li>
                  <li>用词是否准确，是否检查拼写和搭配？</li>
                  <li>是否检查时态、主谓一致、句式和标点？</li>
                </ul>
                <p>自查提示，不生成模拟分数。心得可写入下方复盘笔记并保存。</p>
              </details>
            </>
          ) : (
            <>
              <div className="writing-meta">
                <span>
                  已填写 {filled} / {exercise.answers.length}
                </span>
                <span>与原题题号对应</span>
              </div>
              <Progress value={(filled / exercise.answers.length) * 100} />
              <nav className="answer-map" aria-label="题号导航">
                {exercise.answers.map((_, i) => (
                  <button
                    key={i}
                    className={
                      completed
                        ? data.results?.[i]
                          ? "is-correct"
                          : "is-incorrect"
                        : data.answers[i]?.trim()
                          ? "is-filled"
                          : ""
                    }
                    aria-label={`跳转第 ${exercise.start + i} 题，${completed ? (data.results?.[i] ? "正确" : "错误") : data.answers[i]?.trim() ? "已填写" : "未填写"}`}
                    onClick={() => {
                      const target = document.getElementById(`answer-row-${i}`);
                      target?.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                      });
                      target?.focus({ preventScroll: true });
                    }}
                  >
                    {exercise.start + i}
                  </button>
                ))}
              </nav>
              <div className="answers">
                {exercise.answers.map((key, i) => (
                  <div
                    className="answer-row"
                    id={`answer-row-${i}`}
                    tabIndex={-1}
                    key={i}
                  >
                    <label
                      htmlFor={`a-${i}`}
                      className={
                        completed
                          ? data.results?.[i]
                            ? "correct"
                            : "incorrect"
                          : ""
                      }
                    >
                      {exercise.start + i}
                    </label>
                    <div>
                      {exercise.type.includes("TRUE") ? (
                        <Select
                          value={data.answers[i] || undefined}
                          disabled={completed || submitting || leaving}
                          onValueChange={(v) =>
                            change({
                              answers: data.answers.map((a, j) =>
                                j === i ? v : a,
                              ),
                            })
                          }
                        >
                          <SelectTrigger
                            id={`a-${i}`}
                            aria-label={`第 ${exercise.start + i} 题`}
                          >
                            <SelectValue placeholder="选择答案" />
                          </SelectTrigger>
                          <SelectContent>
                            {["TRUE", "FALSE", "NOT GIVEN"].map((v) => (
                              <SelectItem value={v} key={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input
                          id={`a-${i}`}
                          aria-label={`第 ${exercise.start + i} 题`}
                          maxLength={180}
                          value={data.answers[i]}
                          readOnly={completed || submitting || leaving}
                          autoComplete="off"
                          onChange={(e) =>
                            change({
                              answers: data.answers.map((a, j) =>
                                j === i ? e.target.value : a,
                              ),
                            })
                          }
                          placeholder={
                            exercise.type.includes("填空")
                              ? "填写原文中的词"
                              : "填写选项字母"
                          }
                        />
                      )}{" "}
                      {completed && (
                        <p
                          className={
                            data.results?.[i] ? "correct" : "incorrect"
                          }
                        >
                          {data.results?.[i]
                            ? "正确"
                            : "参考答案：" + key.join(" / ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="muted">
                按官方字数限制作答。仅核对本组样题，不换算完整考试分数。
              </p>
            </>
          )}
          <label className="field-label" htmlFor="notes">
            复盘笔记
          </label>
          <textarea
            id="notes"
            className="notes"
            value={data.notes}
            maxLength={5000}
            readOnly={completed || submitting || leaving}
            onChange={(e) => change({ notes: e.target.value })}
            placeholder="记录定位线索、错因或下次想改进的地方…"
          />
          <div className="editor-actions">
            <button className="button secondary" onClick={exportDraft}>
              <Download size={16} /> 导出
            </button>
            {!completed && (
              <>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  <Save size={16} /> 保存
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={async () => {
                    setRunning(false);
                    await save("submit");
                  }}
                >
                  {exercise.kind === "writing" ? "完成并归档" : "提交核对"}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function CloudState({ status }: { status: string }) {
  return status === "已保存到云端" ? (
    <CheckCircle2 size={15} />
  ) : (
    <Save size={15} />
  );
}
function HeadphoneLabel() {
  return <strong>官方录音</strong>;
}
