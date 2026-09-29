# Contributing

Node >=22.13; install with the locked npm workflow. Read AGENTS.md and ARCHITECTURE.md. Make focused Conventional Commits. Changes to storage, identity or session transitions need an ADR. Preserve publisher attribution.

`npm run verify` runs domain tests, TypeScript, application lint, governance checks and production build. Integration: start the loopback dev server, apply the generated migration (see README), then `node tests/api.mjs http://localhost:5173`. Browser QA covers save/reload, submission, words, mobile layout and official source playback. External media availability is not assumed by offline tests.
