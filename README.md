# Loose Girl Trip

Phases 0–6 of [the project plan](./loose-girl-trip-plan.md): a full-screen US map, dated stops, shared trips with Supabase accounts and live edits, invitations, and ORS driving routes with mileage by state. Weather warnings, temperature tiles, and gas/lodging budgets are implemented. The app also includes home-screen installation, a mobile bottom sheet, a monthly timeline, and JSON import/export.

## Run locally

Use Node.js 22 and npm. Run `npm ci`, copy `.env.example` to `.env.local`, and set `ORS_API_KEY` to your own [OpenRouteService key](https://openrouteservice.org/dev/#/signup). Then run `npm run dev` and open http://localhost:3000. The map loads without a key; searching requires ORS. For accounts and routing, pull the linked Supabase variables with `npx vercel@latest env pull .env.local`, preserving your existing local API keys. Set `OPENWEATHER_API_KEY` for temperature tiles and `EIA_API_KEY` for gas estimates. Open-Meteo weather needs no API key.

`npm run build` produces the Vercel-compatible production build. `npm run start` serves it. `npm run lint` and `npm test` check code and data handling; `npm run test:e2e` checks five-stop persistence, editing, deletion, date sorting, drag and keyboard reordering, errors and mobile layout against a production server. Browser tests use explicit search fixtures rather than consuming your ORS quota. Install Chromium with `npx playwright install chromium` if needed.

## Trip behavior

- Search US places, select a result, and enter arrival/departure dates. Same-day stops are allowed (zero nights). Dates must fall within the trip range when one is set.
- New and edited stops sort by date by default. Drag a grip or use the up/down buttons to choose your own order. Manual order survives a refresh; **Sort by date** restores automatic sorting.
- Edit a stop's display name, dates and optional nightly rate. Coordinates remain those of the selected search result; delete and add a replacement to change the place.
- Trip and Stop follow the plan's data model. `Leg` is computed in Phase 3, with longitude/latitude coordinate pairs for its polyline. `gasCost` is computed from state mileage and current EIA prices. Ordering metadata is stored separately from Trip.
- The trip lives under `loose-girl-trip:v1` in localStorage. It is specific to this browser and origin, so localhost and a Vercel preview have separate trips. Clearing browser data removes it. Private browsing or storage restrictions can prevent persistence; the footer reports failed saves. Unreadable saved data is preserved until you explicitly replace it.

## Vercel / GitHub setup

The app has its own Git repository, isolated from the surrounding FOSS workspace. App commits are pushed to [BigOleHealz/loose-girl-trip](https://github.com/BigOleHealz/loose-girl-trip) on `codex/shared-trip-routing`. Vercel Git integration is connected to this repository. Its production branch tracks `main`; pushes to `codex/shared-trip-routing` create Preview deployments. The user approved creating `main` from the tested app commit.

The Vercel project `loose-girl-trip` in `bigolehealzs-projects` is linked, with Next.js, Node 22, `npm ci`, `npm run build`, and the framework-default output directory. Supabase integration variables are set automatically. The user-authorized ORS, OpenWeather and EIA keys are configured as server-side secrets for Development, Preview and Production.

Vercel automatically assigned its first deployment to production at https://loose-girl-trip.vercel.app. Later CLI deployments default to preview. The first hosted build and live server geocoding passed. The Site URL and seven exact callback origins are configured in Supabase Auth. The user chose Google sign-in instead of email magic links; SMTP is not needed. The Google Web OAuth client is created and its provider is enabled in Supabase. Real Google login and session persistence after refresh are verified both locally and on the current Vercel review preview.

The dedicated app repository is connected using Vercel's Git integration. Its Root Directory should be `.`. Pushes to non-production branches create automatic previews. If intentionally added to a GitHub monorepo instead, set Root Directory to `loose-girl-trip`. `.gitignore` and `.vercelignore` exclude credentials, generated builds, local tools and test outputs; never commit `.env.local` or `env.local`.

## Server/client boundaries

`src/components/trip-planner.tsx` loads Leaflet via `next/dynamic` with `ssr: false` inside a Client Component, following the [Next.js lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr). No Leaflet JavaScript runs during SSR. Global Leaflet CSS is imported in the root layout.

`src/app/api/geocode/route.ts` validates input, calls [ORS geocoding](https://api.openrouteservice.org/) on the server, restricts results to the US and returns normalized place data. Search is debounced by 300ms; stale requests are aborted. API errors use safe messages rather than upstream bodies or key-bearing URLs. Results use Next.js fetch revalidation (24 hours); there is no in-memory cache. OSM base tiles are browser requests, with attribution and no credentials.

EIA/climate/forecast handlers use Next.js fetch revalidation of 24 hours/30 days/1 hour respectively. OpenWeather tiles use `/api/tiles/[layer]/[z]/[x]/[y]` to protect the key, restrict the supported layer and tile coordinates, and cache tiles for one hour. Routing is implemented through the authenticated `/api/route` handler, with Next.js fetch revalidation (7 days) plus the shared database cache. The Census states static import is about 290KB and is used only on the server. There is no server process-memory cache.

## Accounts, shared trips and routes

Guests keep Phase 1 trips on their device. Sign in from **Plan together** using **Continue with Google**. On first sign-in, **Upload my local trip** moves that trip into Supabase atomically and removes the local copy only after a successful upload. Signed-in trip data stays in Supabase; localStorage stores only the active trip ID. **New shared trip** starts a separate trip.

The owner creates an invite valid for seven days. Anyone holding that link can sign in and join as an editor. Both travelers can edit settings and stops; Realtime updates the open trip without a refresh. Updates write a single stop row, so concurrent edits to different stops do not overwrite each other. The last saved edit to the same stop wins. Shared stops and settings are recovered on refresh.

Shared trips with two or more stops calculate ORS driving routes. Each leg shows miles, driving hours and approximate state mileage; the map draws the actual driving polyline. The persisted `legs` table uses trip ID plus directed coordinate pairs, and a database lease prevents concurrent devices from independently calculating the same leg. Name/date/settings changes do not request new routes. Reordering requests the new directed legs and reuses stored matches. State allocation samples the route about every five miles against a simplified Census map; border and shoreline estimates are approximate, and unmatched samples are labeled **Outside mapped states**. See `src/data/README.md` for data provenance.

## Weather and budget

Stops more than 14 days away use ten complete years of [Open-Meteo ERA5-Land historical weather](https://open-meteo.com/en/docs/historical-weather-api). Monthly highs and lows are weighted by the stay dates; departure day is excluded, except same-day visits use that day. Arrivals within 14 days use the [live forecast](https://open-meteo.com/en/docs), with an explicit coverage note when only part of the stay is forecast. Red pins mean lows below your cold threshold, yellow means within 5°F above it, and green means warmer. Missing data stays gray and can be retried.

Cold stops show warmer months and a date-move button. The suggestion preserves stay length and stays within the trip range; it is disabled when no suitable stay fits. The toggleable OpenWeather temperature overlay shows current temperatures, independently of the trip dates, with a Fahrenheit legend. Weather results are derived from current dates and threshold rather than persisting stale weather with a stop.

[EIA weekly regular gasoline prices](https://www.eia.gov/opendata/documentation.php) are fetched server-side. Each leg sums state miles / vehicle MPG × price, using an individual state quote, then its PADD region, then the national quote. The panel shows the quoted week and available prices. Lodging uses nights × the stop override or trip default; a zero override is valid. Gas, lodging, total, per-person split, and remaining/over-budget amounts update with edits. Missing routes or gas prices produce a labeled known subtotal rather than a misleading complete total. Guests can estimate lodging and weather; driving routes and their gas estimates require a shared trip.

Pin popups show dates, weather, nights, lodging, and incoming-leg gas. Both travelers calculate the same current estimates from synchronized stops/settings. MPG, rate, traveler count and weather threshold changes recalculate locally without new routing calls. No additional Supabase migration or credentials are needed for Phases 4–5.

## Supabase setup

A Supabase Free Plan project named `loose-girl-trip` is provisioned through the Vercel integration. All five tables have RLS and explicit grants; only trip members can access their trip. Owner-only invitations and authenticated membership functions prevent self-enrollment without a valid invite. Admin credentials are used only by optional live verification and database tooling, never application browser code.

The applied schema is `supabase/migrations/20261011185249_shared_trips_and_routes.sql`. For a new backend, run `node scripts/supabase-db.mjs push` after pulling integration variables into the ignored `.env.local`. This wrapper reads the database URL without printing it. `node scripts/supabase-db.mjs advisors` runs the security advisor. Do not replay the migration manually on the existing provisioned backend.

Supabase Auth URL configuration is saved. Google sign-in replaces the original magic-link choice at the user's request; no SMTP provider is needed.

1. Configured Site URL: `https://loose-girl-trip.vercel.app`. Allowed callbacks: that domain, the current review preview below, the previous review preview `https://loose-girl-trip-asnyqrctp-bigolehealzs-projects.vercel.app`, `http://localhost:3000`, and `http://127.0.0.1:3107`, each with `/auth/confirm**`. The Phase 4–5 preview and stable branch alias below are also allowed. Use the stable alias for subsequent updates; add any additional review origin explicitly.
2. Google Cloud project `loose-girl-trip` has been created without billing. Google's User Data Policy is accepted, and a Web OAuth client is created with redirect URI `https://ktkpyttypxnyzjevgtoa.supabase.co/auth/v1/callback` for the Supabase browser OAuth flow (email and profile only).
3. The user saved the client ID and secret in Supabase Auth, and Google is Enabled. Keep the secret in provider configuration, never frontend code or Git.
4. The app uses PKCE and returns through `/auth/confirm`; invite destinations survive the redirect. The callback allows only the homepage or an invite route. Legacy hashed-token support remains for disposable-account verification without sending mail.

## Verification

`npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e` are the project checks. The live shared-trip browser test creates disposable confirmed accounts using the server-only admin key, generates sign-in links without sending emails, exercises migration/invites/Realtime/RLS/real ORS routes, and deletes its accounts afterward. It skips if the necessary local Supabase/ORS variables are absent. Traces are disabled for that test so tokens are not captured.

The installed global Vercel CLI is outdated (33.4.1). Use `npx vercel@latest` or upgrade with `npm i -g vercel@latest`; deployment and provisioning here used 63.1.2. Hosted builds use Node 22. The local host currently runs Node 26, so npm displays an engine warning.

Dependency audit currently reports five high-severity entries in the development-only Next ESLint/glob chain. npm proposes a downgrade to Next 14 tooling; this has not been applied because it conflicts with this Next 16 app. No production dependency vulnerabilities are reported. Revisit when a compatible upstream fix is available.

Verified October 11, 2026: production build and lint pass. Fourteen unit/API checks cover weather/date calculations, gas fallbacks, lodging, totals, validation, cache lifetimes and tile-key isolation. All nine browser checks pass, exercising desktop/mobile weather and budget interactions alongside persistence, invites, RLS, live shared settings, and real ORS routing. Live provider checks return Denver January lows near 14°F with Jun–Sep suggestions, Phoenix May lows near 67°F, current forecast data, EIA weekly prices, and proxied PNG temperature tiles. Physical phones have not been tested.

The previous Google-authenticated review preview is https://loose-girl-trip-24yqoeclp-bigolehealzs-projects.vercel.app. Its callback is allowed in Supabase and hosted Google login survives refresh. Each new preview origin needs its own Supabase callback entry before real Google login; local sign-in already works. Phase 4–5 implementation commit: `b5fd4f9` on `codex/shared-trip-routing`, pushed to GitHub. The automatic Git preview is READY: https://loose-girl-trip-ee6aoguee-bigolehealzs-projects.vercel.app. Its hosted weather, gas, and tile endpoints return real data successfully. The user approved both this preview callback and the stable branch callback in Supabase.

Current review URL: https://loose-girl-trip-git-codex-shared-t-11e503-bigolehealzs-projects.vercel.app — use this alias for future updates on this branch. Google login is enabled for `/auth/confirm**` on this origin. Phase 6 production release is recorded below.

## Phase 6: install, plan and take it with you

The [Next.js web app manifest](https://nextjs.org/docs/app/guides/progressive-web-apps), 192/512px icons, separate maskable icon, Apple touch icon and viewport metadata support home-screen installation. Open **Install app** for Safari/iPhone instructions or the browser install prompt where supported. The service worker caches only the public offline reconnect page. Trip data, authentication, API responses and map tiles are never cached by the worker; live features require connectivity.

On phones, the planner is a bottom sheet above the full-screen map. Use **Show map**, **Open trip planner**, the expand button, or drag the grip to resize it. The grip also supports keyboard activation. Safe-area spacing and reduced-motion settings are respected. Map bounds account for the visible area above the sheet.

Open **Monthly timeline** to see all twelve months, including cross-month/year stays and same-day visits. Navigate between years. Climate colors use each location's monthly average low against your threshold; near-term stops use the current forecast stay estimate. Pending data is gray. Tap a stay to focus the map. Departure day is excluded from lodging nights.

**Export trip JSON** downloads settings and stops in the exact plan model, preserving their chosen order and zero nightly overrides. No account/session data or API credentials are included. Derived weather/routes are recalculated on import. **Import trip JSON** validates files up to 1 MB / 200 stops, then shows a preview before saving. Guests can download their current trip before confirming replacement. Signed-in imports use the existing atomic `create_trip` RPC to create a new shared trip with fresh IDs; original trips and memberships stay intact. No schema changes are required.

Phase 6 validation covers file round trips, invalid/canceled imports, new shared copies, month/year/leap-day boundaries, weather colors, mobile sheet/keyboard interactions, map focus, PWA assets and offline behavior. Desktop and simulated mobile browsers are verified; physical home-screen installation has not been tested. The optional seed lodging-rate table and custom domain are deferred.

Production destination: https://loose-girl-trip.vercel.app. Google callback configuration already includes this origin. Promote only after the reviewed Phase 6 build passes; production uses the configured server-only provider keys and Supabase integration. The release status will be recorded after hosted verification.
