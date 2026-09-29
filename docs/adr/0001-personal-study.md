# ADR 0001: Private academic IELTS workspace

Accepted 2026-09-28. User requested a personal Academic IELTS site with authentic exercises and persistent memory, and instructed continued implementation.

Use a private Sites deployment, dispatch-provided identity, and D1 owner-scoped records. No client-provided owner identity. Structured records use optimistic revisions; stale writes return 409 rather than overwrite another device. Each write carries an event ID; duplicate successful writes are idempotent. Server-computed grading and review dates prevent client-derived authoritative scores.

Official IELTS PDFs remain at their publisher origins and are embedded with an always-visible source link. Official recording URLs are obtained from annotations in the corresponding PDF. Store only exercise metadata, factual answer keys, and original vocabulary explanations. Do not republish passages or invent historical test provenance. All exercises are labelled official samples, not past papers. External source availability is a dependency; show fallback links when embeds or audio are unavailable.

Session states: draft -> submitted. Submitted sessions are immutable; a repeat creates a new ID. Guard submission against missing answers/empty essays. Save states: loading -> ready -> dirty -> saving -> saved, or error/conflict; keep input on failure, explicit retry, no unbounded retries. Conflicts require exporting the local draft before reload. Pending drafts can use a local recovery cache but D1 remains authoritative.

Word review is deterministic: again resets stage, familiar retains it, remembered advances it. Due dates use server UTC; duplicate events do not advance twice. Save data and revision/event atomically. No external side effects from saves. Schema/machine version 1; append migrations for future changes. No destructive delete flow in v1.

Goal: immediate listening/reading/writing practice plus a personal vocabulary loop. Non-goals: social features, payments, unverified mock tests, AI band scoring. Verify grading, transitions, validation, persistence/reload, auth, conflicts, duplicate writes, responsive views, and production build.
