# Architecture

Independent target (not yet deployed): `standalone/main.tsx` reuses the study UI; `standalone/server.mjs` serves the built client, username/password sessions and SQLite records. See ADR 0002 and docs/independent-deployment.md. One persistent server, one provisioned account; phones and computers read the same database. This is separate from the existing Sites deployment described below.

Vinext/React browser UI -> same-origin `/api/records` -> dispatch user identity -> validation/domain logic -> D1 prepared statements. Sites owns private access and real authentication. Local preview uses the starter's loopback-only mock account.

`lib/catalog.ts`: verified source metadata, original vocabulary, factual answer keys. `lib/domain.mjs`: pure validation/grading/review functions. `db/schema.ts`: generated D1 migration source. `app/practice.tsx`: serial autosave, immutable submission, local temporary recovery. `app/words.tsx`: collection and review. No AI scoring service.

Data model version 1: composite primary key (owner,id), kind, JSON data, monotonic revision, last successful event, updated UTC. Concurrent CAS writes return 409. Immediate retries of the last event return the committed record; a replay after an intervening event is rejected as stale and cannot mutate data twice. Submission performs grading and the state transition in one atomic write. No external side effects need an outbox.

Sources: IELTS.org official 2023 sample PDFs for reading, listening and academic writing. Audio uses the corresponding official IELTS.org CDN files (all five endpoints checked successfully). Source files remain at publisher origins; embedding depends on publisher availability and browser PDF support. Sources have open-in-new-tab fallbacks. No third-party passages are mirrored.

See `docs/adr/0001-personal-study.md` for boundaries and state transitions.
