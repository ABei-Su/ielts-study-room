import {
  Headphones,
  BookOpen,
  PenLine,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  ShieldCheck,
} from "lucide-react";
import { officialSource, exercises } from "@/lib/catalog";
import type { StudyRecord, SessionData, WordData } from "@/lib/types";
import { useNow } from "./use-now";
import { recentDrafts } from "@/lib/study-view.mjs";
export default function Overview({
  records,
  navigate,
  onResume,
  loading,
}: {
  records: StudyRecord[];
  navigate: (view: string) => void;
  onResume: (record: StudyRecord) => void;
  loading: boolean;
}) {
  const now = useNow();
  const sessions = records.filter((r) => r.kind === "session");
  const words = records.filter((r) => r.kind === "word");
  const drafts = recentDrafts(sessions).filter((r) =>
    exercises.some((e) => e.id === (r.data as SessionData).exerciseId),
  );
  const counts = [
    sessions.filter((r) => (r.data as SessionData).status === "submitted")
      .length,
    sessions.filter(
      (r) =>
        exercises.find((e) => e.id === (r.data as SessionData).exerciseId)
          ?.kind === "writing",
    ).length,
    words.length,
    words.filter((r) => (r.data as WordData).due <= now).length,
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">IELTS ACADEMIC</p>
          <h1>开始今天的学习</h1>
          <p>选择专项练习，或接着上次的进度。</p>
        </div>
        <span className="pill">IELTS Academic</span>
      </div>
      {drafts[0] && (
        <div className="continue-banner">
          <div>
            <span className="eyebrow">上次学到这里</span>
            <h3>
              继续上次的{" "}
              {
                exercises.find(
                  (e) => e.id === (drafts[0].data as SessionData).exerciseId,
                )?.title
              }
            </h3>
          </div>
          <button className="button" onClick={() => onResume(drafts[0])}>
            继续学习 <ArrowRight size={16} />
          </button>
        </div>
      )}
      <section className="stats-grid">
        {[
          ["已完成练习", "次"],
          ["写作存档", "篇"],
          ["收藏生词", "个"],
          ["待复习单词", "个"],
        ].map(([label, unit], i) => (
          <div className="stat" key={label}>
            <p>{label}</p>
            <strong>
              {loading ? "—" : counts[i]}
              <small>{unit}</small>
            </strong>
          </div>
        ))}
      </section>
      <div className="section-heading">
        <h2>开始今日练习</h2>
        <span>IELTS 官方样题</span>
      </div>
      <section className="practice-grid">
        {[
          {
            id: "listening",
            en: "LISTENING",
            name: "听力",
            icon: Headphones,
            desc: "听懂细节，捕捉关键信息。",
            num: "01",
            meta: `${exercises.filter((e) => e.kind === "listening").length} 组官方专项 · 配套录音`,
          },
          {
            id: "reading",
            en: "READING",
            name: "阅读",
            icon: BookOpen,
            desc: "带着问题，找到每一处依据。",
            num: "02",
            meta: `${exercises.filter((e) => e.kind === "reading").length} 组官方专项 · 即时核对`,
          },
          {
            id: "writing",
            en: "WRITING",
            name: "写作",
            icon: PenLine,
            desc: "把观点，写得清晰有力。",
            num: "03",
            meta: `${exercises.filter((e) => e.kind === "writing").length} 道官方题目 · 自动存稿`,
          },
        ].map((c) => (
          <button
            className={"practice-card " + c.id}
            key={c.id}
            onClick={() => navigate(c.id)}
          >
            <div className="card-top">
              <c.icon size={25} />
              <span>{c.num}</span>
            </div>
            <p className="eyebrow">{c.en}</p>
            <h3>
              {c.name}
              <ArrowUpRight size={28} />
            </h3>
            <p>{c.desc}</p>
            <div className="card-bottom">
              {c.meta}
              <ArrowRight size={16} />
            </div>
          </button>
        ))}
      </section>
      <div className="bottom-grid">
        <section className="vocab-banner">
          <div className="word-emblem">
            <Bookmark size={26} />
          </div>
          <div>
            <p className="eyebrow">单词复习</p>
            <h2>复习你的单词</h2>
            <p>回忆释义，巩固到期生词。</p>
          </div>
          <button className="button" onClick={() => navigate("learn")}>
            开始学词 <ArrowRight size={16} />
          </button>
        </section>
        <section className="source-panel">
          <ShieldCheck size={22} />
          <h3>每道题，都有出处</h3>
          <p>收录 IELTS 官方公开样题。原题、音频和参考答案均可追溯。</p>
          <a href={officialSource} target="_blank" rel="noreferrer">
            查看官方来源 <ArrowUpRight size={15} />
          </a>
        </section>
      </div>
    </>
  );
}
