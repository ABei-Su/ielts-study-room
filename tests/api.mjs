import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.argv[2];
if (base !== "http://localhost:5173")
  throw new Error("Explicit local preview URL http://localhost:5173 required");
const login = await fetch(base + "/signin-with-chatgpt?return_to=/", {
  redirect: "manual",
});
assert.equal(login.status, 302);
const cookie = login.headers.get("set-cookie").split(";")[0];
const headers = {
  "Content-Type": "application/json",
  Origin: base,
  Cookie: cookie,
};
async function post(payload, custom = headers) {
  const r = await fetch(base + "/api/records", {
    method: "POST",
    headers: custom,
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text };
  }
  return { status: r.status, body };
}
const newSession = () => ({
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
    notes: "automated local test",
    elapsed: 0,
    audioTime: 0,
  },
});
assert.equal((await fetch(base + "/api/records")).status, 401);
assert.equal(
  (
    await fetch(base + "/api/records", {
      headers: {
        "oai-authenticated-user-id": "spoof",
        "oai-authenticated-user-email": "spoof@test",
      },
    })
  ).status,
  401,
);
assert.equal(
  (await post(newSession(), { ...headers, Origin: "https://evil.example" }))
    .status,
  403,
);
const request = newSession();
const created = await post(request);
assert.equal(created.status, 200);
assert.equal(created.body.record.revision, 1);
const replay = await post(request);
assert.equal(replay.body.record.revision, 1);
const conflict = await post({ ...request, event: randomUUID() });
assert.equal(conflict.status, 409);
const races = await Promise.all(
  [1, 2].map(() => post({ ...request, revision: 1, event: randomUUID() })),
);
assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
const submit = await post({
  ...request,
  revision: 2,
  event: randomUUID(),
  action: "submit",
  data: { ...request.data, score: 999 },
});
assert.equal(submit.status, 200);
assert.equal(submit.body.record.data.score, 4);
assert.equal(submit.body.record.data.status, "submitted");
assert.equal(
  (await post({ ...request, revision: 3, event: randomUUID() })).status,
  409,
);
const incomplete = newSession();
incomplete.data.answers = ["", "", "", ""];
incomplete.action = "submit";
assert.equal((await post(incomplete)).status, 400);
const word = {
  id: randomUUID(),
  kind: "word",
  revision: 0,
  event: randomUUID(),
  action: "save",
  data: {
    word: "testword",
    meaning: "local test",
    example: "",
    source: "test",
  },
};
assert.equal((await post(word)).status, 200);
const review = {
  ...word,
  revision: 1,
  event: randomUUID(),
  action: "review",
  rating: "remembered",
};
const reviewed = await post(review);
assert.equal(reviewed.body.record.data.stage, 1);
assert.equal(reviewed.body.record.data.reviews, 1);
assert.equal((await post(review)).body.record.data.reviews, 1);
const read = await fetch(base + "/api/records", {
  headers: { Cookie: cookie },
});
const all = await read.json();
assert.equal(all.records.find((r) => r.id === request.id).data.score, 4);
console.log(
  "PASS: authentication, spoof rejection, origin, save/read, duplicate events, stale revisions, race, server grading, terminal state, incomplete submission, vocabulary review",
);
