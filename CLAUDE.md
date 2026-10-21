# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

집지킴 360 — a no-build, zero-dependency prototype of a Korean rental-safety proptech app (villa AI pricing, HUG 126% deposit-guarantee check, escrow direct contract, move-out photo vault). One codebase serves both a mobile PWA and a responsive desktop website. All listing/registry/transaction data is mock; identity verification, bank escrow, TSA and payments are simulated. The product spec is `PRD_ZIPJIKIM_360.md` (v1.1 — a corrected version of the user's v1.0; the corrections are also surfaced in-app via `ZJ.PRD_CHANGES`). `PRD.md` (v1.2) is the Supabase backend plan; P0 (auth, listings DB, sync) is implemented, P1+ (two-party contracts, Edge Functions, cron) is not. UI text and code comments are Korean.

## Commands

- Run: `node server.js` (or `npm start`) → http://localhost:5173. `.claude/launch.json` defines the same server as `zipjikim` for the preview browser.
- Syntax check (there is no linter, bundler, or test suite): `node --check js/app.js js/engines.js js/data.js js/sb.js`
- Engines can be exercised headlessly in Node by stubbing `window`:
  `node -e "global.window=global; require('./js/data.js'); require('./js/engines.js'); const l=ZJ.LISTINGS[2]; console.log(ZJ.eng.diagnose(l))"`
- RLS check without real accounts: in one `execute_sql` call, `begin;` → insert fake `auth.users` rows → `set local role authenticated; select set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}',true);` → query → `rollback;`
- Preview browser serves a stale shell from the service worker: unregister it and clear `caches` before verifying JS changes.

## Architecture

Plain `<script>` tags (not ES modules, so `file://` also works) loaded in order `data.js → engines.js → app.js → supabase-js (CDN) → sb.js`, all sharing the global namespace `window.ZJ`:

- `js/data.js` — `ZJ.CONST` (base rate, HUG multiplier, fixed "today" = 2026-10-21), `ZJ.LISTINGS` (10 demo listings, money in **만원**; each one deliberately exercises a risk case — see README table), special clauses, the 4-zone/12-checkpoint vault layout, depreciation reference values, PRD change list.
- `js/engines.js` — pure functions on `ZJ.eng`. Comparable sales are generated deterministically from a seeded RNG keyed on listing id (`comps`), then `estimate` inverts the hedonic `factors` to price the target unit. `hug` implements the corrected rule: deposit + senior 근저당 채권최고액 + (다가구) senior lease deposits ≤ official price × 1.26; violation buildings always fail. `diagnose` combines this with the other 8 checklist items into level 0/1/2 (안전/주의/위험) and a score. Also: 2021 brokerage-fee table, depreciation liability, SHA-256 (WebCrypto with pure-JS fallback) and Merkle root.
- `js/app.js` — single IIFE containing the whole UI:
  - Hash router `#/<page>/<arg>` (`home`, `listing`, `check`, `contract`, `vault`, `report`, `my`); each `view*` function returns an HTML string, `render(keepScroll)` swaps `#view`, then `after(page)` runs post-render hooks (map drag init, signature pad, Merkle root).
  - Event delegation on `document`: `data-act="name"` → `actions[name](el, e)`; `data-go="#/..."` → navigation; `data-input="name"` → `inputs[name](el, e)` on input/change. Add new interactions by adding a key to `actions`/`inputs`, not by attaching listeners.
  - Partial re-renders exist where focus/slider state must survive (`refreshHomeList`, `#hug-block`, `#manual-result`, `#fee-out`); everything else calls `render(true)`.
  - `state` is persisted per key via `store` (localStorage with `zj_` prefix, try/catch-wrapped). The contract wizard lives in `state.ct` (steps: 인증 → 조건 → 특약 → 서명·봉인 → 에스크로); the vault in `state.vault` (photos stored as downscaled JPEG data URLs plus hash of the original file).
  - Engine results are memoized per listing in `memo` via `diag(l)`.
- `js/sb.js` — Supabase backend (project `zipjikim-360`, ref `mgeiqrxzuueygnemnwkq`, ap-northeast-2), loaded after `app.js` together with supabase-js 2.45.4 from jsDelivr. It reaches into the app through `ZJ.app` (exported at the end of `app.js`). `store.set` calls `ZJ.sb.push(key, value)`, which debounces writes to `favorites` / `user_state` / `contracts` / `vaults` / `vault_photos` + the private Storage bucket `vault-photos/{uid}/{phase}/{slot}`. Use `store.put` for local-only writes, e.g. when applying server data. On login, `pull()` merges server state into local, then uploads anything that exists only locally. Realtime on `contracts` / `vaults` / `vault_photos` triggers a re-pull; `_cid` filters out echoes of the tab's own writes. `listings` rows map back to the `ZJ.LISTINGS` shape (core columns + `detail` jsonb). `seals` is append-only, with server time enforced by a trigger. If the CDN or the server is unreachable, `ZJ.sb.enabled` is false or listings stay local, and the app works as the offline demo. Auth uses `flowType: 'pkce'` on purpose — implicit-flow tokens in `#access_token=…` would collide with the hash router.
- `supabase/migrations/*.sql` mirror what was applied to the project; `supabase/seed.sql` is generated from `js/data.js` (re-generate if listings change). After DDL, check Supabase security advisors.
- `css/style.css` — design tokens on `:root`; mobile-first. At `min-width: 1024px` the bottom `.tabbar` is replaced by `#webnav` (rendered in `render()`), home becomes a list|map grid, and listing detail becomes two columns. Listing detail relies on `.d-side`/`.d-main` being `display: contents` with `order` on mobile and real grid columns on desktop — keep both when changing that markup. `@media print` styles the move-out report for PDF saving.
- `sw.js` — network-first cache of the app shell; bump `CACHE` when adding shell files.

## Conventions

- Money values in data/engines are 만원; convert with `E.fmtMan` (만원) or `E.fmtWon` (원) for display.
- Legal/financial copy is demo text and should stay labeled as such (clauses need lawyer review; depreciation useful-life values need validation) — see PRD §4 and §7.
- Live: https://zip-ji-kim.vercel.app (Vercel project `zip-ji-kim`, auto-deploys on push to `main`, static, no build). Vercel auto-detects the "Node" preset from `package.json` — it must be "Other". `.vercelignore` excludes `supabase/`, `server.js`, `*.md`, so those 404 in production by design.
- Supabase Auth Site URL / Redirect URLs are set to the Vercel origin + `http://localhost:5173/**`; update them if the domain changes. The default Supabase email sender is rate-limited (configure SMTP before real users).
- Supabase MCP `create_project` requires `get_cost` → user confirmation → `confirm_cost`, even at $0.
- MY → "데모 데이터 초기화" also wipes the logged-in user's cloud rows and Storage photos; `seals` rows survive (append-only).
- Pushes go to `origin` = https://github.com/ultraJH-collab/ZipJiKim (branch `main`).
