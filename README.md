# Loose Girl Trip

Phases 0–3 of [the project plan](./loose-girl-trip-plan.md): a full-screen US map, dated stops, shared trips with Supabase accounts and live edits, invitations, and ORS driving routes with mileage by state. Weather and gas/budget calculations are reserved for Phases 4–5.

## Run locally

Use Node.js 22 and npm. Run `npm ci`, copy `.env.example` to `.env.local`, and set `ORS_API_KEY` to your own [OpenRouteService key](https://openrouteservice.org/dev/#/signup). Then run `npm run dev` and open http://localhost:3000. The map loads without a key; searching requires ORS. For accounts and routing, pull the linked Supabase variables with `npx vercel@latest env pull .env.local`, preserving your existing local API keys. OpenWeather and EIA keys are reserved for later phases.

`npm run build` produces the Vercel-compatible production build. `npm run start` serves it. `npm run lint` and `npm test` check code and data handling; `npm run test:e2e` checks five-stop persistence, editing, deletion, date sorting, drag and keyboard reordering, errors and mobile layout against a production server. Browser tests use explicit search fixtures rather than consuming your ORS quota. Install Chromium with `npx playwright install chromium` if needed.

## Trip behavior

- Search US places, select a result, and enter arrival/departure dates. Same-day stops are allowed (zero nights). Dates must fall within the trip range when one is set.
- New and edited stops sort by date by default. Drag a grip or use the up/down buttons to choose your own order. Manual order survives a refresh; **Sort by date** restores automatic sorting.
- Edit a stop's display name, dates and optional nightly rate. Coordinates remain those of the selected search result; delete and add a replacement to change the place.
- Trip and Stop follow the plan's data model. `Leg` is computed in Phase 3, with longitude/latitude coordinate pairs for its polyline. `gasCost` stays zero until Phase 5; no gas estimate is shown yet. Ordering metadata is stored separately from Trip.
- The trip lives under `loose-girl-trip:v1` in localStorage. It is specific to this browser and origin, so localhost and a Vercel preview have separate trips. Clearing browser data removes it. Private browsing or storage restrictions can prevent persistence; the footer reports failed saves. Unreadable saved data is preserved until you explicitly replace it.

## Vercel / GitHub setup

The app has its own Git repository, isolated from the surrounding FOSS workspace. The Phase 0–3 commits are pushed to [BigOleHealz/loose-girl-trip](https://github.com/BigOleHealz/loose-girl-trip) on `codex/shared-trip-routing`. Vercel Git integration is awaiting GitHub authorization; automatic Git deployments are not connected yet.

The Vercel project `loose-girl-trip` in `bigolehealzs-projects` is linked, with Next.js, Node 22, `npm ci`, `npm run build`, and the framework-default output directory. Supabase integration variables are set automatically. The user-authorized ORS, OpenWeather and EIA keys are configured as server-side secrets for Development, Preview and Production.

Vercel automatically assigned its first deployment to production at https://loose-girl-trip.vercel.app. Later CLI deployments default to preview. The first hosted build and live server geocoding passed. The Site URL and four exact callback origins are configured in Supabase Auth. The user chose Google sign-in instead of email magic links; SMTP is not needed. Google provider configuration is still pending.

Complete GitHub authorization and connect this dedicated app repository using Vercel's Git integration. Its Root Directory should be `.`. Branch pushes then create automatic previews. If intentionally added to a GitHub monorepo instead, set Root Directory to `loose-girl-trip`. `.gitignore` and `.vercelignore` exclude credentials, generated builds, local tools and test outputs; never commit `.env.local` or `env.local`.

## Server/client boundaries

`src/components/trip-planner.tsx` loads Leaflet via `next/dynamic` with `ssr: false` inside a Client Component, following the [Next.js lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr). No Leaflet JavaScript runs during SSR. Global Leaflet CSS is imported in the root layout.

`src/app/api/geocode/route.ts` validates input, calls [ORS geocoding](https://api.openrouteservice.org/) on the server, restricts results to the US and returns normalized place data. Search is debounced by 300ms; stale requests are aborted. API errors use safe messages rather than upstream bodies or key-bearing URLs. Results use Next.js fetch revalidation (24 hours); there is no in-memory cache. OSM base tiles are browser requests, with attribution and no credentials.

Future EIA/climate/forecast handlers must use fetch revalidation of 24 hours/30 days/1 hour respectively. Future OpenWeather tiles must use `/api/tiles/[layer]/[z]/[x]/[y]` to protect the key. Routing is implemented through the authenticated `/api/route` handler, with Next.js fetch revalidation (7 days) plus the shared database cache. The Census states static import is about 290KB and is used only on the server. There is no server process-memory cache.

## Accounts, shared trips and routes

Guests keep Phase 1 trips on their device. Sign in from **Plan together** using **Continue with Google**. On first sign-in, **Upload my local trip** moves that trip into Supabase atomically and removes the local copy only after a successful upload. Signed-in trip data stays in Supabase; localStorage stores only the active trip ID. **New shared trip** starts a separate trip.

The owner creates an invite valid for seven days. Anyone holding that link can sign in and join as an editor. Both travelers can edit settings and stops; Realtime updates the open trip without a refresh. Updates write a single stop row, so concurrent edits to different stops do not overwrite each other. The last saved edit to the same stop wins. Shared stops and settings are recovered on refresh.

Shared trips with two or more stops calculate ORS driving routes. Each leg shows miles, driving hours and approximate state mileage; the map draws the actual driving polyline. The persisted `legs` table uses trip ID plus directed coordinate pairs, and a database lease prevents concurrent devices from independently calculating the same leg. Name/date/settings changes do not request new routes. Reordering requests the new directed legs and reuses stored matches. State allocation samples the route about every five miles against a simplified Census map; border and shoreline estimates are approximate, and unmatched samples are labeled **Outside mapped states**. See `src/data/README.md` for data provenance.

## Supabase setup

A Supabase Free Plan project named `loose-girl-trip` is provisioned through the Vercel integration. All five tables have RLS and explicit grants; only trip members can access their trip. Owner-only invitations and authenticated membership functions prevent self-enrollment without a valid invite. Admin credentials are used only by optional live verification and database tooling, never application browser code.

The applied schema is `supabase/migrations/20261011185249_shared_trips_and_routes.sql`. For a new backend, run `node scripts/supabase-db.mjs push` after pulling integration variables into the ignored `.env.local`. This wrapper reads the database URL without printing it. `node scripts/supabase-db.mjs advisors` runs the security advisor. Do not replay the migration manually on the existing provisioned backend.

Supabase Auth URL configuration is saved. Google sign-in replaces the original magic-link choice at the user's request; no SMTP provider is needed.

1. Configured Site URL: `https://loose-girl-trip.vercel.app`. Allowed callbacks: that domain, the review preview below, `http://localhost:3000`, and `http://127.0.0.1:3107`, each with `/auth/confirm**`. Add each new review origin explicitly.
2. Google Cloud project `loose-girl-trip` has been created without billing. Its Google Auth branding setup is awaiting explicit approval of Google's User Data Policy. Afterward create a Web OAuth client with redirect URI `https://ktkpyttypxnyzjevgtoa.supabase.co/auth/v1/callback` and basic identity scopes (openid, email, profile).
3. Enable the Google provider in Supabase Auth with that client ID and secret. Keep the secret in Supabase's provider configuration, never frontend code or Git. Until the provider is enabled, the Google button cannot complete a real login.
4. The app uses PKCE and returns through `/auth/confirm`; invite destinations survive the redirect. The callback allows only the homepage or an invite route. Legacy hashed-token support remains for disposable-account verification without sending mail.

## Verification

`npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e` are the project checks. The live shared-trip browser test creates disposable confirmed accounts using the server-only admin key, generates sign-in links without sending emails, exercises migration/invites/Realtime/RLS/real ORS routes, and deletes its accounts afterward. It skips if the necessary local Supabase/ORS variables are absent. Traces are disabled for that test so tokens are not captured.

The installed global Vercel CLI is outdated (33.4.1). Use `npx vercel@latest` or upgrade with `npm i -g vercel@latest`; deployment and provisioning here used 63.1.2. Hosted builds use Node 22. The local host currently runs Node 26, so npm displays an engine warning.

Dependency audit currently reports five high-severity entries in the development-only Next ESLint/glob chain. npm proposes a downgrade to Next 14 tooling; this has not been applied because it conflicts with this Next 16 app. No production dependency vulnerabilities are reported. Revisit when a compatible upstream fix is available.

Verified October 11, 2026: local production build, lint and seven unit/API checks pass. All six production-browser tests pass, including two different accounts, desktop/mobile viewports, local-trip migration, live edits and deletions, a real 540-mile ORS route, nonmember RLS restrictions, expired invites, and a concurrent claimed/pending route-cache lease. No routing requests occur on name/date edits. Database security advisors report no issues. This verifies the Phase 2–3 interaction criteria using temporary accounts without sending email; the Google PKCE redirect is tested, but a real Google account login remains pending provider setup. Physical phones have not been tested.

Current review preview: https://loose-girl-trip-asnyqrctp-bigolehealzs-projects.vercel.app — READY, Node 22, hosted build and browser map loading verified (24/24 tiles). Phase 2–3 implementation commit: `a600a6f` on `codex/shared-trip-routing`. GitHub push is complete; Vercel Git authorization remains pending. The preview still contains the previous email sign-in UI until the Google changes are deployed.
