# IELTS study workspace

Preserve official question provenance. Never label samples as past papers. Do not copy publisher PDFs/audio into source; use verified publisher URLs. Original vocabulary explanations are not official questions.

D1 is authoritative. Every API mutation requires dispatch identity, same-origin JSON, input validation, revision guard and event ID. Submitted sessions are immutable. Preserve user text on all errors. Append migrations; never rewrite a deployed migration.

Independent deployment exception (ADR 0002): standalone/server.mjs uses a provisioned personal account, HttpOnly sessions and persistent SQLite. The Sites API remains unchanged. Independent deployment requires its own host and must not be represented as live until verified. Never publish database volumes, passwords or test accounts.

Run `npm run verify`. Run `node tests/api.mjs http://localhost:5173` against the local preview after applying the migration. Never use integration fixtures against a live site. Never publish .sites-runtime, .wrangler, credentials or local test records.
