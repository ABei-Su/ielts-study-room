import { getChatGPTUser } from "../../chatgpt-auth";
import { database, unpack, type Row } from "@/db/records";
import { exercises } from "@/lib/catalog";
import { validateRecord, submitSession, reviewWord } from "@/lib/domain.mjs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "请先登录" }, 401);
  try {
    const result = await database()
      .prepare(
        "SELECT id,kind,data,revision,event,updated FROM study_records WHERE owner = ? ORDER BY updated DESC",
      )
      .bind(user.userId)
      .all<Row>();
    return reply({ records: result.results.map(unpack) });
  } catch {
    console.error("study_load_failed");
    return reply({ error: "暂时无法读取学习记录，请重试。" }, 503);
  }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return reply({ error: "请先登录" }, 401);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return reply({ error: "来源验证失败" }, 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return reply({ error: "请求格式错误" }, 415);
  try {
    const raw = await request.text();
    if (raw.length > 45000) return reply({ error: "内容过长" }, 413);
    const { id, kind, data, revision, event, action, rating } = JSON.parse(raw);
    if (
      typeof id !== "string" ||
      !/^[a-z0-9:_-]{1,120}$/i.test(id) ||
      typeof event !== "string" ||
      !/^[a-z0-9-]{16,80}$/i.test(event) ||
      !Number.isInteger(revision) ||
      revision < 0
    )
      return reply({ error: "无效记录" }, 400);
    if (!["save", "submit", "review"].includes(action))
      return reply({ error: "无效操作" }, 400);
    const db = database();
    const old = await db
      .prepare(
        "SELECT id,kind,data,revision,event,updated FROM study_records WHERE owner = ? AND id = ?",
      )
      .bind(user.userId, id)
      .first<Row>();
    if (old?.event === event) return reply({ record: unpack(old) });
    if ((old?.revision ?? 0) !== revision)
      return reply(
        { error: "另一页面更新了这条记录。请先下载当前草稿，再重新载入。" },
        409,
      );
    if (old && old.kind !== kind)
      return reply({ error: "记录类型不匹配" }, 400);
    const prior = old ? JSON.parse(old.data) : null;
    const clean = validateRecord(kind, data);
    let output: unknown;
    const now = Date.now();
    if (kind === "session") {
      if (action === "review" || prior?.status === "submitted")
        return reply({ error: "已完成的练习不可覆盖，请新建练习。" }, 409);
      const exercise = exercises.find((x) => x.id === clean.exerciseId);
      if (
        !exercise ||
        (prior && prior.exerciseId !== clean.exerciseId) ||
        clean.answers.length !== exercise.answers.length
      )
        return reply({ error: "题目或答案数量不匹配" }, 400);
      output =
        action === "submit"
          ? submitSession({ ...clean, status: "draft" }, exercise)
          : { ...clean, status: "draft" };
    } else {
      if (action === "submit" || (action === "review" && !prior))
        return reply({ error: "请先收藏单词" }, 400);
      if (prior && prior.word.toLowerCase() !== clean.word?.toLowerCase())
        return reply({ error: "单词不匹配" }, 400);
      const progress = {
        stage: prior?.stage ?? 0,
        due: prior?.due ?? now,
        reviews: prior?.reviews ?? 0,
      };
      output = {
        ...clean,
        ...progress,
        ...(action === "review"
          ? {
              ...reviewWord(progress.stage, rating, now),
              reviews: progress.reviews + 1,
            }
          : {}),
      };
    }
    const result = old
      ? await db
          .prepare(
            "UPDATE study_records SET data=?,revision=revision+1,event=?,updated=? WHERE owner=? AND id=? AND revision=? RETURNING id,kind,data,revision,event,updated",
          )
          .bind(JSON.stringify(output), event, now, user.userId, id, revision)
          .first<Row>()
      : await db
          .prepare(
            "INSERT INTO study_records (owner,id,kind,data,revision,event,updated) VALUES (?,?,?,?,1,?,?) ON CONFLICT(owner,id) DO NOTHING RETURNING id,kind,data,revision,event,updated",
          )
          .bind(user.userId, id, kind, JSON.stringify(output), event, now)
          .first<Row>();
    if (!result)
      return reply({ error: "记录已变化，请保留草稿后重新载入。" }, 409);
    return reply({ record: unpack(result) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      error instanceof SyntaxError ||
      /INVALID|INCOMPLETE|TERMINAL/.test(message)
    )
      return reply(
        {
          error:
            message === "INCOMPLETE"
              ? "请完成全部答案，或输入作文后再提交。"
              : "输入不符合要求，请检查。",
        },
        400,
      );
    console.error("study_save_failed");
    return reply(
      { error: "保存失败，内容仍在页面中。请检查网络后重试。" },
      503,
    );
  }
}
