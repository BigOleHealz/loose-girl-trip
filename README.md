# Loose Girl Trip

Phases 0–1 of [the project plan](./loose-girl-trip-plan.md): a full-screen US map, trip settings, geocoded stops, dates, drag ordering and device-local persistence. Routes, weather overlays and budget calculations belong to later phases.

## Run locally

Use Node.js 22 and npm. Run `npm ci`, copy `.env.example` to `.env.local`, and set `ORS_API_KEY` to your own [OpenRouteService key](https://openrouteservice.org/dev/#/signup). Then run `npm run dev` and open http://localhost:3000. The map loads without a key; searching requires ORS. OpenWeather and EIA keys are reserved for later phases.

`npm run build` produces the Vercel-compatible production build. `npm run start` serves it. `npm run lint` and `npm test` check code and data handling; `npm run test:e2e` checks five-stop persistence, editing, deletion, date sorting, drag and keyboard reordering, errors and mobile layout against a production server. Browser tests use explicit search fixtures rather than consuming your ORS quota. Install Chromium with `npx playwright install chromium` if needed.

## Trip behavior

- Search US places, select a result, and enter arrival/departure dates. Same-day stops are allowed (zero nights). Dates must fall within the trip range when one is set.
- New and edited stops sort by date by default. Drag a grip or use the up/down buttons to choose your own order. Manual order survives a refresh; **Sort by date** restores automatic sorting.
- Edit a stop's display name, dates and optional nightly rate. Coordinates remain those of the selected search result; delete and add a replacement to change the place.
- Trip and Stop follow the plan's data model. `Leg` is defined for Phase 2, with a coordinate-pair array for its polyline; routing is not implemented yet. Ordering metadata is stored separately from Trip.
- The trip lives under `loose-girl-trip:v1` in localStorage. It is specific to this browser and origin, so localhost and a Vercel preview have separate trips. Clearing browser data removes it. Private browsing or storage restrictions can prevent persistence; the footer reports failed saves. Unreadable saved data is preserved until you explicitly replace it.

## Vercel / GitHub setup

This app now has its own Git repository, isolated from the surrounding FOSS workspace. The initial implementation is committed on `codex/phase-0-1`; its GitHub remote still needs to be configured. Push **only this app repository**, excluding `.env.local`, `env.local`, `node_modules`, `.next`, `.vercel`, and test outputs (covered by `.gitignore`). If deployed from this dedicated repository, Vercel's Root Directory is the repository root. If intentionally added to a GitHub monorepo instead, set Root Directory to `loose-girl-trip`.

1. Import the app's GitHub repository into Vercel. Select Next.js, Node.js 22.x, `npm ci` as the install command and `npm run build` as the build command. Leave the output directory on its framework default.
2. Add `ORS_API_KEY` in Vercel Project Settings → Environment Variables for Preview and Production. Add `OPENWEATHER_API_KEY` and `EIA_API_KEY` when configuring later phases. Use the same names, without `NEXT_PUBLIC_`. Do not put key values in GitHub source.
3. Deploy a preview and check the empty map. Search and add five dated stops, refresh, and verify five list entries and map pins remain. This completes Phase 0's hosted-preview criterion, which cannot be claimed until the project is connected.
4. Subsequent GitHub branch pushes produce preview deployments through Vercel's Git integration. Changes to env vars require a new deployment.

The installed global Vercel CLI is 33.4.1. Upgrade it with `npm i -g vercel@latest` before CLI-based linking or deployment. GitHub dashboard import does not require the CLI.

## Server/client boundaries

`src/components/trip-planner.tsx` loads Leaflet via `next/dynamic` with `ssr: false` inside a Client Component, following the [Next.js lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading#skipping-ssr). No Leaflet JavaScript runs during SSR. Global Leaflet CSS is imported in the root layout.

`src/app/api/geocode/route.ts` validates input, calls [ORS geocoding](https://api.openrouteservice.org/) on the server, restricts results to the US and returns normalized place data. Search is debounced by 300ms; stale requests are aborted. API errors use safe messages rather than upstream bodies or key-bearing URLs. Results use Next.js fetch revalidation (24 hours); there is no in-memory cache. OSM base tiles are browser requests, with attribution and no credentials.

Future EIA/climate/forecast handlers must use fetch revalidation of 24 hours/30 days/1 hour respectively. Future OpenWeather tiles must use `/api/tiles/[layer]/[z]/[x]/[y]` to protect the key. Future routing must run only when stops change, with a small simplified states GeoJSON for Turf. These are deployment constraints for later phases, not implemented features.

## Current verification limits

Verified on October 11, 2026: `npm run build` and TypeScript checks pass, lint has no errors or warnings, all four data/API tests pass, and all four production-server browser tests pass. The browser test added five dated stops through search results, refreshed, checked all five persisted dates and pins, and exercised drag ordering, button ordering, editing and deletion. API tests verified server-side ORS request construction, normalization, persistent fetch caching, quota/error responses and credential exclusion using a stubbed upstream response.

Local tests used the available Chromium binary via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; a fresh setup can use `npx playwright install chromium` instead. Browser search responses are deterministic fixtures. A live ORS request and a Vercel preview still require your key and account hookup. No live third-party API credentials have been used or committed. Phase 1's local persistence criterion passes; Phase 0's hosted-preview criterion remains pending.
