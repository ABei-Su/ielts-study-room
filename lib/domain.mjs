export function normalize(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[‐‑–—-]/g, " ")
    .replace(/\s+/g, " ");
}
export function grade(answers, keys) {
  return keys.map(
    (options, i) =>
      Boolean(normalize(answers[i] ?? "")) &&
      options.some((key) => normalize(key) === normalize(answers[i])),
  );
}
export function wordCount(text) {
  return (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
}
export function submitSession(session, exercise) {
  if (session.status !== "draft") throw new Error("TERMINAL");
  if (exercise.kind === "writing") {
    if (!wordCount(session.essay)) throw new Error("INCOMPLETE");
    return { ...session, status: "submitted", score: null, results: [] };
  }
  if (
    exercise.answers.length !== session.answers.length ||
    session.answers.some((a) => !a.trim())
  )
    throw new Error("INCOMPLETE");
  const results = grade(session.answers, exercise.answers);
  return {
    ...session,
    status: "submitted",
    results,
    score: results.filter(Boolean).length,
  };
}
export function reviewWord(stage, rating, now) {
  if (!["again", "familiar", "remembered"].includes(rating))
    throw new Error("INVALID_RATING");
  const next =
    rating === "again"
      ? 0
      : rating === "remembered"
        ? Math.min(6, stage + 1)
        : stage;
  const days = [0, 1, 3, 7, 14, 30, 60];
  return {
    stage: next,
    due:
      now + (rating === "again" ? 600000 : Math.max(1, days[next]) * 86400000),
  };
}
function string(value, max, min = 0) {
  if (typeof value !== "string" || value.length > max || value.length < min)
    throw new Error("INVALID_RECORD");
  return value;
}
export function validateRecord(kind, value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_RECORD");
  if (kind === "session") {
    if (!["draft", "submitted"].includes(value.status))
      throw new Error("INVALID_RECORD");
    const exerciseId = string(value.exerciseId, 60, 1),
      essay = string(value.essay ?? "", 30000);
    if (!Array.isArray(value.answers) || value.answers.length > 50)
      throw new Error("INVALID_RECORD");
    const answers = value.answers.map((a) => string(a, 180));
    const elapsed = Number(value.elapsed ?? 0),
      audioTime = Number(value.audioTime ?? 0);
    if (
      !Number.isFinite(elapsed) ||
      elapsed < 0 ||
      elapsed > 86400 ||
      !Number.isFinite(audioTime) ||
      audioTime < 0 ||
      audioTime > 10000
    )
      throw new Error("INVALID_RECORD");
    return {
      exerciseId,
      essay,
      answers,
      status: value.status,
      elapsed: Math.floor(elapsed),
      audioTime,
      notes: string(value.notes ?? "", 5000),
    };
  }
  if (kind === "word") {
    const word = string(value.word, 80, 1).trim();
    if (!/^[A-Za-z][A-Za-z '\u2019-]*$/.test(word))
      throw new Error("INVALID_WORD");
    return {
      word,
      meaning: string(value.meaning, 500, 1),
      example: string(value.example ?? "", 1000),
      source: string(value.source ?? "个人收藏", 120),
    };
  }
  throw new Error("INVALID_KIND");
}
