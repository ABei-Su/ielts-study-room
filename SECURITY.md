# Security

Independent deployment: only HTTPS on the public origin; server port behind a reverse proxy preserving Host. All records require a provisioned account session. Scrypt hashes the password, session tokens are random and stored hashed, cookies are HttpOnly/SameSite=Strict/Secure. Same-origin mutations, persistent failed-login throttling, bounded input, expiry and logout revocation are enforced. No open registration, default production password or ChatGPT dependency. The database volume and backups are private. See ADR 0002; the restrictions below apply to the existing Sites target.

The site must stay owner-private. Never expose the worker directly outside Sites dispatch. Only dispatch headers establish identity; no owner is accepted from the request body. APIs reject anonymous calls and cross-origin writes. Every read/write includes owner. JSON input is bounded; SQL is parameterized. UI renders user text through React escaping.

Browser recovery storage holds unsynced drafts only, namespaced by site user ID and record. Cloud records are authoritative. Downloads are explicit user actions. Error logs contain event categories only. Official media requests disclose standard browser connection metadata to their publishers.

Report problems privately to the site owner. No public issue should contain learning records, draft text, credentials or cookies.
