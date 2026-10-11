import test from "node:test";
import assert from "node:assert/strict";
import { exercises } from "../lib/catalog.ts";
import { grade } from "../lib/domain.mjs";
import { matchesExercise } from "../lib/study-view.mjs";

test("catalog keeps unique stable identifiers and official publisher assets", () => {
  assert.equal(new Set(exercises.map((e) => e.id)).size, exercises.length);
  for (const e of exercises) {
    assert.equal(new URL(e.pdf).hostname, "ielts.org");
    assert(e.page > 0 && e.keyPage > e.page);
    if (e.kind === "listening")
      assert.equal(new URL(e.audio).hostname, "ielts.org");
    if (e.kind !== "writing")
      assert(
        e.answers.length > 0 &&
          e.answers.every((a) => a.length && a.every(Boolean)),
      );
  }
});
test("new reading keys align with official answer pages, accept optional articles", () => {
  const cases = [
    ["r-aging", 9, 11, ["glucose", "free radicals", "preservation"]],
    ["r-science", 19, 22, ["B", "D", "F"]],
    [
      "r-curie-notes",
      30,
      33,
      ["thorium", "pitchblende", "radium", "soldiers", "illness", "neutron"],
    ],
    [
      "r-birds",
      34,
      37,
      ["theropods", "collarbones", "reptile", "similarities", "claw"],
    ],
    ["r-language", 38, 40, ["E", "G", "B", "F"]],
    [
      "r-plain-english",
      41,
      43,
      [
        "frustration",
        "first-time user",
        "essential",
        "special knowledge",
        "legal formulations",
      ],
    ],
    [
      "r-greenhouse",
      44,
      46,
      [
        "dry hot air",
        "moist cool air",
        "infrared light",
        "the condenser",
        "pure distilled water",
      ],
    ],
  ];
  for (const [id, page, keyPage, answers] of cases) {
    const e = exercises.find((e) => e.id === id);
    assert.equal(e.page, page);
    assert.equal(e.keyPage, keyPage);
    assert.deepEqual(
      grade(answers, e.answers),
      answers.map(() => true),
    );
    assert.deepEqual(
      grade(
        answers.map(() => ""),
        e.answers,
      ),
      answers.map(() => false),
    );
  }
});
test("search combines topic keywords with exact question type", () => {
  const e = exercises.find((e) => e.id === "r-curie-notes");
  assert(matchesExercise(e, "  MARIE   notes  ", "all"));
  assert(matchesExercise(e, "研究", "笔记填空"));
  assert(!matchesExercise(e, "研究", "句子填空"));
  assert(!matchesExercise(e, "missing", "all"));
  assert(matchesExercise(e, "  ", "all"));
});
