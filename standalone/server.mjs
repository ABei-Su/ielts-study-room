import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exercises } from "../lib/catalog.ts";
import { validateRecord, submitSession, reviewWord } from "../lib/domain.mjs";

const derive = promisify(scrypt);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
const DAY = 86400000;
export async function createStudyServer({
  databasePath,
  origin,
  username,
  initialPassword,
  secure = true,
  now = Date.now,
  staticDirectory = resolve("standalone-dist"),
}) {
  const canonical = new URL(origin);
  if (
    canonical.origin !== origin ||
    (canonical.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(canonical.hostname))
  )
    throw new Error(
      "APP_ORIGIN must be an HTTPS origin (HTTP is allowed only for local testing)",
    );
  if (!secure && !["localhost", "127.0.0.1"].includes(canonical.hostname))
    throw new Error("Secure cookies required outside localhost");
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS account (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL,event TEXT NOT NULL,updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS throttle (id INTEGER PRIMARY KEY CHECK(id=1), attempts INTEGER NOT NULL, until_ms INTEGER NOT NULL);`);
  try {
    if (!db.prepare("SELECT id FROM account WHERE id=1").get()) {
      if (
        !/^[A-Za-z0-9_.-]{3,40}$/.test(username ?? "") ||
        typeof initialPassword !== "string" ||
        initialPassword.length < 12 ||
        initialPassword.length > 200
      )
        throw new Error(
          "Set STUDY_USERNAME and a 12–200 character STUDY_INITIAL_PASSWORD before first startup",
        );
      const salt = randomBytes(24).toString("hex");
      const key = Buffer.from(await derive(initialPassword, salt, 64));
      db.prepare("INSERT INTO account VALUES(1,?,?,?)").run(
        username,
        salt,
        key.toString("hex"),
      );
    }
  } catch (error) {
    db.close();
    throw error;
  }
  const unpack = (row) => ({
    id: row.id,
    kind: row.kind,
    data: JSON.parse(row.data),
    revision: row.revision,
    updated: row.updated,
  });
  const tokenFrom = (req) =>
    /(?:^|;\s*)study_session=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie ?? "",
    )?.[1];
  const authorized = (req) => {
    const token = tokenFrom(req);
    const session =
      token &&
      db
        .prepare("SELECT expires FROM sessions WHERE token_hash=?")
        .get(hash(token));
    return session && session.expires > now();
  };
  const cookie = (token, age) =>
    `study_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(JSON.stringify(body));
  };
  const body = async (req) => {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw fail(415, "请使用 JSON 格式");
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 180000) throw fail(413, "内容过长");
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString());
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      return value;
    } catch {
      throw fail(400, "请求格式错误");
    }
  };
  let loginBusy = false;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://ielts.org; media-src https://ielts.org; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    try {
      if (req.headers.host !== canonical.host)
        throw fail(403, "访问地址不匹配");
      const path = new URL(req.url, origin).pathname;
      if (!["GET", "POST"].includes(req.method))
        throw fail(405, "不支持的操作");
      if (req.method === "POST" && req.headers.origin !== origin)
        throw fail(403, "来源验证失败");
      if (path === "/api/auth/login" && req.method === "POST") {
        const input = await body(req);
        if (
          typeof input.password !== "string" ||
          input.password.length > 200 ||
          typeof input.username !== "string" ||
          input.username.length > 40
        )
          throw fail(400, "请输入账号和密码");
        const throttle = db.prepare("SELECT * FROM throttle WHERE id=1").get();
        if (
          loginBusy ||
          (throttle && throttle.until_ms > now() && throttle.attempts >= 8)
        )
          throw fail(429, "尝试过于频繁，请 15 分钟后重试");
        loginBusy = true;
        try {
          const account = db.prepare("SELECT * FROM account WHERE id=1").get();
          const candidate = Buffer.from(
            await derive(input.password, account.salt, 64),
          );
          if (
            !timingSafeEqual(
              candidate,
              Buffer.from(account.password_hash, "hex"),
            ) ||
            input.username !== account.username
          ) {
            const attempts =
              throttle && throttle.until_ms > now() ? throttle.attempts + 1 : 1;
            db.prepare("INSERT OR REPLACE INTO throttle VALUES(1,?,?)").run(
              attempts,
              throttle && throttle.until_ms > now()
                ? throttle.until_ms
                : now() + 900000,
            );
            throw fail(401, "账号或密码不正确");
          }
          db.prepare("DELETE FROM throttle").run();
          db.prepare("DELETE FROM sessions WHERE expires<=?").run(now());
          const token = randomBytes(32).toString("hex");
          const age = input.remember === true ? 30 * DAY : DAY;
          db.prepare("INSERT INTO sessions VALUES(?,?)").run(
            hash(token),
            now() + age,
          );
          return json(
            res,
            200,
            { user: { id: "personal", username: account.username } },
            { "Set-Cookie": cookie(token, age / 1000) },
          );
        } finally {
          loginBusy = false;
        }
      }
      if (path.startsWith("/api/")) {
        if (!authorized(req))
          throw fail(401, "登录已过期，请重新登录。当前草稿仍保留在页面中。");
        if (path === "/api/auth/session" && req.method === "GET")
          return json(res, 200, {
            user: {
              id: "personal",
              username: db
                .prepare("SELECT username FROM account WHERE id=1")
                .get().username,
            },
          });
        if (path === "/api/auth/logout" && req.method === "POST") {
          db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
            hash(tokenFrom(req)),
          );
          return json(res, 200, { ok: true }, { "Set-Cookie": cookie("", 0) });
        }
        if (path === "/api/records" && req.method === "GET")
          return json(res, 200, {
            records: db
              .prepare("SELECT * FROM records ORDER BY updated DESC")
              .all()
              .map(unpack),
          });
        if (path === "/api/records" && req.method === "POST") {
          const { id, kind, data, revision, event, action, rating } =
            await body(req);
          if (
            typeof id !== "string" ||
            !/^[a-z0-9:_-]{1,120}$/i.test(id) ||
            typeof event !== "string" ||
            !/^[a-z0-9-]{16,80}$/i.test(event) ||
            !Number.isSafeInteger(revision) ||
            revision < 0 ||
            !["save", "submit", "review"].includes(action)
          )
            throw fail(400, "输入不符合要求");
          db.exec("BEGIN IMMEDIATE");
          try {
            const old = db.prepare("SELECT * FROM records WHERE id=?").get(id);
            if (old?.event === event) {
              db.exec("COMMIT");
              return json(res, 200, { record: unpack(old) });
            }
            if ((old?.revision ?? 0) !== revision)
              throw fail(409, "另一页面已更新记录，请先导出草稿再重新载入");
            if (old && old.kind !== kind) throw fail(400, "输入不符合要求");
            const prior = old ? JSON.parse(old.data) : null;
            const clean = validateRecord(kind, data);
            let output;
            if (kind === "session") {
              if (action === "review" || prior?.status === "submitted")
                throw fail(409, "已完成的练习不可覆盖，请新建练习");
              const exercise = exercises.find((e) => e.id === clean.exerciseId);
              if (
                !exercise ||
                clean.answers.length !== exercise.answers.length ||
                (prior && prior.exerciseId !== clean.exerciseId)
              )
                throw fail(400, "题目或答案数量不匹配");
              output =
                action === "submit"
                  ? submitSession({ ...clean, status: "draft" }, exercise)
                  : { ...clean, status: "draft" };
            } else {
              if (
                action === "submit" ||
                (action === "review" && !prior) ||
                (prior && prior.word.toLowerCase() !== clean.word.toLowerCase())
              )
                throw fail(400, "单词或操作不匹配");
              const progress = {
                stage: prior?.stage ?? 0,
                due: prior?.due ?? now(),
                reviews: prior?.reviews ?? 0,
              };
              output = {
                ...clean,
                ...progress,
                ...(action === "review"
                  ? {
                      ...reviewWord(progress.stage, rating, now()),
                      reviews: progress.reviews + 1,
                    }
                  : {}),
              };
            }
            const saved = {
              id,
              kind,
              data: output,
              revision: revision + 1,
              updated: now(),
            };
            db.prepare(
              "INSERT OR REPLACE INTO records VALUES(?,?,?,?,?,?)",
            ).run(
              id,
              kind,
              JSON.stringify(output),
              saved.revision,
              event,
              saved.updated,
            );
            db.exec("COMMIT");
            return json(res, 200, { record: saved });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        throw fail(404, "接口不存在");
      }
      if (req.method !== "GET") throw fail(405, "不支持的操作");
      const file = resolve(
        staticDirectory,
        "." + decodeURIComponent(path === "/" ? "/index.html" : path),
      );
      if (
        !file.startsWith(resolve(staticDirectory) + sep) ||
        /(^|[\\/])\./.test(decodeURIComponent(path)) ||
        !existsSync(file)
      )
        throw fail(404, "页面不存在");
      const mime =
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
          ".ico": "image/x-icon",
        }[extname(file)] ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": path.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      res.end(readFileSync(file));
    } catch (error) {
      const message =
        error.message === "INCOMPLETE"
          ? "请完成全部答案，或输入作文后再提交。"
          : /INVALID|TERMINAL/.test(error.message)
            ? "输入不符合要求，请检查。"
            : error.status
              ? error.message
              : "服务暂不可用，请保留草稿后重试";
      json(
        res,
        error.status ??
          (/INVALID|INCOMPLETE|TERMINAL/.test(error.message) ? 400 : 503),
        { error: message },
      );
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    server,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const origin = process.env.APP_ORIGIN;
  if (!origin) throw new Error("APP_ORIGIN is required");
  const app = await createStudyServer({
    databasePath: resolve(process.env.DATA_DIR ?? "data", "study.sqlite"),
    origin,
    username: process.env.STUDY_USERNAME,
    initialPassword: process.env.STUDY_INITIAL_PASSWORD,
    secure: origin.startsWith("https:"),
  });
  app.server.listen(
    Number(process.env.PORT ?? 8080),
    process.env.HOST ?? "127.0.0.1",
    () => console.log("IELTS independent server ready"),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => void app.close().then(() => process.exit(0)));
}
