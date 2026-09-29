import test from "node:test";
import assert from "node:assert/strict";
import {
  grade,
  reviewWord,
  validateRecord,
  submitSession,
  wordCount,
} from "../lib/domain.mjs";

test("grading normalizes case and whitespace but never accepts an empty answer", () => {
  assert.deepEqual(grade([" c ", "a", ""], [["C"], ["A"], ["B"]]), [
    true,
    true,
    false,
  ]);
});
test("answer spelling alternatives and hyphen variants are respected", () => {
  assert.deepEqual(
    grade(
      ["TIME-MANAGEMENT", "summer schools"],
      [["time management"], ["summer school", "summer schools"]],
    ),
    [true, true],
  );
});
test("submitted sessions cannot mutate and incomplete responses cannot submit", () => {
  assert.throws(
    () =>
      submitSession(
        { status: "draft", answers: [""], essay: "" },
        { kind: "reading", answers: [["A"]] },
      ),
    /INCOMPLETE/,
  );
  assert.throws(
    () =>
      submitSession(
        { status: "submitted", answers: ["A"] },
        { kind: "reading", answers: [["A"]] },
      ),
    /TERMINAL/,
  );
  assert.equal(
    submitSession(
      { status: "draft", answers: ["A"], essay: "" },
      { kind: "reading", answers: [["A"]] },
    ).score,
    1,
  );
});
test("review stages have bounded deterministic intervals", () => {
  assert.equal(reviewWord(0, "remembered", 0).due, 86400000);
  assert.equal(reviewWord(3, "again", 0).stage, 0);
  assert.equal(reviewWord(6, "remembered", 0).stage, 6);
  assert.throws(() => reviewWord(0, "invalid", 0));
});
test("reject malformed records, oversize essays and prototype keys", () => {
  assert.throws(() =>
    validateRecord("session", {
      status: "draft",
      exerciseId: "x",
      answers: [],
      essay: "a".repeat(30001),
    }),
  );
  assert.throws(() => validateRecord("word", { word: "", meaning: "" }));
  assert.throws(() => validateRecord("__proto__", {}));
});
test("word counter excludes punctuation and Chinese text", () => {
  assert.equal(wordCount("I'm studying. 这是备注 — well-being"), 3);
});
test("textbook source survives validation and rejects overlong references", () => {
  const word = {
    word: "conservation",
    meaning: "保护",
    source: "IELTS Trainer 1 · Test 1 · p.12",
  };
  assert.equal(validateRecord("word", word).source, word.source);
  assert.throws(() =>
    validateRecord("word", { ...word, source: "x".repeat(121) }),
  );
});
