import { BookOpen, BookmarkPlus } from "lucide-react";

const books = [
  {
    title: "跟雅思考官 Simon 学写作",
    area: "写作",
    note: "订单显示新升级版；完整书名与版本待版权页确认。",
  },
  {
    title: "IELTS Trainer 1",
    area: "综合 · Academic",
    note: "剑桥雅思官方模考题 1；等待题目、答案及配套音频。",
  },
  {
    title: "IELTS Trainer 2",
    area: "综合 · Academic",
    note: "剑桥雅思官方模考题 2；等待题目、答案及配套音频。",
  },
  {
    title: "雅思阅读真经三件套",
    area: "阅读",
    note: "订单注明：阅读考点词真经、总纲、真经 5。各册版本待确认。",
  },
  {
    title: "雅思王听力真题语料库",
    area: "听力",
    note: "订单注明剑 20 版、机考；等待目录、正文及配套录音。",
  },
  { title: "雅思词汇真经", area: "词汇", note: "刘洪波词汇；等待目录和词表。" },
];

export default function Books({
  onCollect,
  enabled,
}: {
  onCollect: () => void;
  enabled: boolean;
}) {
  return (
    <>
      <div className="notice">
        <div>
          <strong>你的教材书架已建立，书内内容尚未导入。</strong>
          <p>
            书目来自你提供的订单截图，版本以版权页为准。请在与我对话时提供目录、题目页、答案页或电子资料；听力还需要对应录音。核对后才能按书册、章节和题号接入练习。
          </p>
        </div>
      </div>
      <div className="book-grid">
        {books.map((book) => (
          <article className="book-card" key={book.title}>
            <div className="row">
              <BookOpen size={28} />
              <span className="tag">{book.area}</span>
            </div>
            <h2>{book.title}</h2>
            <p>{book.note}</p>
            <span className="book-status">等待提供内页 · 未同步题目</span>
          </article>
        ))}
      </div>
      <div className="notice" style={{ marginTop: 24 }}>
        <div>
          <strong>现在就可以记录书里的生词</strong>
          <p>
            添加生词时填写“教材 / 章节 /
            页码”，来源会与单词一起保存到云端。完整题目接入前，可继续使用站内 15
            组官方样题。
          </p>
        </div>
        <button
          className="button secondary"
          disabled={!enabled}
          onClick={onCollect}
        >
          <BookmarkPlus size={16} />
          记一个生词
        </button>
      </div>
    </>
  );
}
