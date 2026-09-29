import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { createStudyServer } from "../standalone/server.mjs";

test("independent login, shared persistence, safety boundaries and restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ielts-test-"));
  const origin = "https://study.test";
  const password = randomUUID();
  let app;
  let clock = 1800000000000;
  const open = async (initialPassword) => {
    app = await createStudyServer({
      databasePath: join(dir, "study.sqlite"),
      origin,
      username: "learner",
      initialPassword,
      secure: true,
      now: () => clock,
    });
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${app.server.address().port}`;
  };
  let base = await open(password);
  const request = (path, body, cookie = "", customOrigin = origin) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(
        base + path,
        {
          method: body ? "POST" : "GET",
          headers: {
            Host: "study.test",
            Origin: customOrigin,
            "Content-Type": "application/json",
            Cookie: cookie,
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString();
            resolve(
              new Response(text, {
                status: res.statusCode,
                headers: Object.fromEntries(
                  Object.entries(res.headers).map(([k, v]) => [
                    k,
                    Array.isArray(v) ? v.join(",") : v,
                  ]),
                ),
              }),
            );
          });
        },
      );
      req.on("error", reject);
      req.end(body ? JSON.stringify(body) : undefined);
    });
  try {
    assert.equal((await request("/api/records")).status, 401);
    assert.equal(
      (
        await request("/api/auth/login", {
          username: "learner",
          password: "wrong",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/api/auth/login",
          { username: "learner", password },
          "",
          "http://evil.test",
        )
      ).status,
      403,
    );
    const login = await request("/api/auth/login", {
      username: "learner",
      password,
      remember: true,
    });
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get("set-cookie");
    assert.match(cookieHeader, /HttpOnly/);
    assert.match(cookieHeader, /Secure/);
    assert.match(cookieHeader, /SameSite=Strict/);
    const cookie = cookieHeader.split(";")[0];
    const session = await request("/api/auth/session", null, cookie);
    assert.equal((await session.json()).user.username, "learner");
    const command = {
      id: randomUUID(),
      kind: "session",
      revision: 0,
      event: randomUUID(),
      action: "save",
      data: {
        exerciseId: "r-rockets",
        status: "draft",
        answers: ["A", "A", "B", "E"],
        essay: "",
        notes: "shared draft",
        elapsed: 0,
        audioTime: 0,
      },
    };
    const save = await request("/api/records", command, cookie);
    assert.equal(save.status, 200, await save.clone().text());
    assert.equal(
      (await (await request("/api/records", command, cookie)).json()).record
        .revision,
      1,
    );
    assert.equal(
      (
        await request(
          "/api/records",
          { ...command, event: randomUUID() },
          cookie,
        )
      ).status,
      409,
    );
    const second = await request("/api/auth/login", {
      username: "learner",
      password,
    });
    const secondCookie = second.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await (await request("/api/records", null, secondCookie)).json())
        .records[0].data.notes,
      "shared draft",
    );
    const submitted = await request(
      "/api/records",
      { ...command, revision: 1, event: randomUUID(), action: "submit" },
      cookie,
    );
    assert.equal((await submitted.json()).record.data.score, 4);
    const racing = { ...command, id: randomUUID(), event: randomUUID() };
    const race = await Promise.all([
      request("/api/records", racing, cookie),
      request("/api/records", { ...racing, event: randomUUID() }, secondCookie),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (
        await request(
          "/api/records",
          {
            ...command,
            id: randomUUID(),
            event: randomUUID(),
            action: "submit",
            data: { ...command.data, answers: ["", "", "", ""] },
          },
          cookie,
        )
      ).status,
      400,
    );
    const word = {
      id: randomUUID(),
      kind: "word",
      revision: 0,
      event: randomUUID(),
      action: "save",
      data: { word: "review", meaning: "复习", source: "教材" },
    };
    assert.equal((await request("/api/records", word, cookie)).status, 200);
    const review = {
      ...word,
      revision: 1,
      event: randomUUID(),
      action: "review",
      rating: "remembered",
    };
    const reviewed = await request("/api/records", review, cookie);
    assert.equal((await reviewed.json()).record.data.reviews, 1);
    assert.equal(
      (await (await request("/api/records", review, cookie)).json()).record.data
        .reviews,
      1,
    );
    assert.equal(
      (
        await request(
          "/api/records",
          { ...command, revision: 2, event: randomUUID() },
          cookie,
        )
      ).status,
      409,
    );
    assert.equal((await request("/api/auth/logout", {}, cookie)).status, 200);
    assert.equal((await request("/api/records", null, cookie)).status, 401);
    await app.close();
    base = await open(undefined);
    assert.equal(
      (
        await (await request("/api/records", null, secondCookie)).json()
      ).records.find((r) => r.id === command.id).revision,
      2,
    );
    assert.equal((await request("/.env")).status, 404);
    clock += 86400001;
    assert.equal(
      (await request("/api/records", null, secondCookie)).status,
      401,
    );
    for (let i = 0; i < 8; i++)
      await request("/api/auth/login", {
        username: "learner",
        password: "wrong",
      });
    assert.equal(
      (
        await request("/api/auth/login", {
          username: "learner",
          password: "wrong",
        })
      ).status,
      429,
    );
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
