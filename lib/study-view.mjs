/** @param {import('./types').StudyRecord[]} records */
export function recentDrafts(records) {
  return records
    .filter((r) => r.kind === "session" && r.data.status === "draft")
    .sort((a, b) => b.updated - a.updated || a.id.localeCompare(b.id));
}

/** @param {import('./types').StudyRecord[]} records @param {string} id */
export function exerciseProgress(records, id) {
  const sessions = records.filter(
    (r) => r.kind === "session" && r.data.exerciseId === id,
  );
  const draft = recentDrafts(sessions)[0];
  const completed = sessions.filter(
    (r) => r.data.status === "submitted",
  ).length;
  return {
    draft,
    completed,
    state: draft ? "draft" : completed ? "completed" : "new",
  };
}

/** @param {{title:string,subtitle:string,type:string}} exercise @param {string} query @param {string} type */
export function matchesExercise(exercise, query, type) {
  const haystack =
    `${exercise.title} ${exercise.subtitle} ${exercise.type}`.toLocaleLowerCase();
  return (
    (type === "all" || exercise.type === type) &&
    query
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .every((term) => haystack.includes(term))
  );
}
