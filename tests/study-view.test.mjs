import test from "node:test";
import assert from "node:assert/strict";
import { recentDrafts, exerciseProgress } from "../lib/study-view.mjs";
test("resume newest draft without mutating records; exclude words and submissions", () => {
  const records = [
    {
      id: "old",
      kind: "session",
      updated: 1,
      data: { exerciseId: "r", status: "draft" },
    },
    {
      id: "done",
      kind: "session",
      updated: 9,
      data: { exerciseId: "r", status: "submitted" },
    },
    {
      id: "new",
      kind: "session",
      updated: 4,
      data: { exerciseId: "r", status: "draft" },
    },
    { id: "word", kind: "word", updated: 10, data: {} },
  ];
  assert.deepEqual(
    recentDrafts(records).map((r) => r.id),
    ["new", "old"],
  );
  assert.equal(records[0].id, "old");
  assert.equal(exerciseProgress(records, "r").draft.id, "new");
  assert.equal(exerciseProgress(records, "r").state, "draft");
  assert.equal(exerciseProgress(records, "r").completed, 1);
  assert.equal(exerciseProgress(records, "missing").state, "new");
  assert.equal(exerciseProgress([records[1]], "r").state, "completed");
  assert.deepEqual(recentDrafts([]), []);
});
