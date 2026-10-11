# Loose Girl Trip: Project Plan

A web app for planning a year-long US road trip for two that avoids cold weather and stays on budget.

## What it does

1. You pick the places you want to visit and the dates you'll be at each one.
2. The app draws the driving route on a map, with a temperature overlay that shades actual terrain (mountains vs. plains), not whole states.
3. It warns you when a stop will be too cold for your dates and suggests better months.
4. It estimates **gas** (state-by-state prices) and **lodging** per leg, shows the total against your budget, and splits it between two travelers.

## Stack

| Piece | Choice | Why |
|---|---|---|
| App | Next.js + TypeScript + Tailwind | One codebase, easy deploy (Vercel) |
| Map | Leaflet via `react-leaflet`, OpenStreetMap base tiles | Free, no Google billing |
| Temperature overlay | OpenWeatherMap Weather Maps tile layer (`temp_new`) | Terrain-level shading; free API key |
| Geocoding | OpenRouteService geocoding (same key as routing) | Free place search → lat/lon; OK for production use, unlike public Nominatim |
| Driving route + miles | OpenRouteService Directions (free key) | Route polyline + distance per leg; the public OSRM demo server isn't allowed for production apps |
| Climate averages (planning months out) | Open-Meteo Historical/Climate API | Free, no key, by lat/lon, so elevation is accounted for |
| Live forecast (within ~14 days) | Open-Meteo Forecast API (fallback: api.weather.gov) | Free, no key |
| Gas prices | EIA API v2, weekly retail gasoline | Free key, official source |
| State lookup along route | US states GeoJSON + `@turf/turf` point-in-polygon | Offline, no API calls |
| Accounts + shared data | Supabase (Postgres, Auth, Realtime) via `@supabase/ssr` | Both travelers edit the same trip from their own phones and see changes live; free tier |

### Known data limits (design around these)
- **Forecasts only go out about 2 weeks.** For anything further out, use historical monthly averages. Switch to the live forecast once a stop is within 14 days.
- **EIA weekly gas prices cover only some states individually.** For the rest, fall back to the regional (PADD) average. Keep a `stateToPadd` mapping table.
- **There is no good free hotel-price API.** Lodging is user-entered per stop, pre-filled from a default nightly rate the user sets, such as $90. A seed table of typical rates by city size can come later.

## Vercel deployment requirements (build for these from day one)
- **Leaflet breaks server-side rendering** because it needs `window`. Load the map component with `next/dynamic` and `{ ssr: false }`.
- **No in-memory caching.** Serverless functions don't keep state between requests. Cache API results with Next.js `fetch(..., { next: { revalidate } })`:
  - EIA gas prices: 24h
  - Climate averages: 30 days
  - Forecasts: 1h
- **Keep API keys server-side.** All weather, gas, routing, and geocoding calls go through `/app/api/*` route handlers.
  - The OpenWeather tile layer is the exception, because the browser requests tiles directly. Proxy tiles through `/api/tiles/[layer]/[z]/[x]/[y]` so the key never ships to the client.
- **Respect the free tiers.** Debounce geocoding search (300ms). Only call routing when stops actually change, not on every render.
- **Keep the states GeoJSON small.** Use a simplified version, roughly 100–300KB, as a static import so it bundles fine.
- **Supabase:** connect it with the Supabase ↔ Vercel integration so `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set automatically. The anon key is safe in the browser **only** because row-level security is on for every table.
- **Env vars:** keep `.env.example` in the repo and set the real values in the Vercel project settings. Never commit `.env.local`.
- **Deploy early.** Connect the GitHub repo to Vercel in Phase 0, so every push gets a preview URL and SSR or bundling problems surface early rather than in Phase 6.

## Data model

```ts
Trip {
  id, name, startDate, endDate,
  budgetTotal: number,          // USD
  travelers: number,            // default 2
  vehicleMpg: number,           // default 28
  coldThresholdF: number,       // default: avg daily low < 45°F = warning
  defaultNightlyRate: number,
  stops: Stop[]
}

Stop {
  id, name, lat, lon, state,
  arriveDate, departDate,       // nights = departDate - arriveDate
  nightlyRate?: number,         // overrides default
  weather?: {
    source: "climate" | "forecast",
    avgHighF, avgLowF,
    isCold: boolean,
    bestMonths?: number[]       // months this place is warm enough
  }
}

Leg {
  fromStopId, toStopId,
  miles, durationHrs, polyline,
  milesByState: Record<string, number>,
  gasCost: number
}
```

## Phases

### Phase 0: Setup
- Scaffold Next.js + TS + Tailwind. Add `react-leaflet`, `leaflet`, `@turf/turf`.
- `.env.local` with `OPENWEATHER_API_KEY`, `EIA_API_KEY`, and `ORS_API_KEY` if using OpenRouteService.
- All third-party calls go through Next.js API routes (`/api/...`) so keys stay server-side.
- Push the repo to GitHub and import it into Vercel.
- **Done when:** the empty full-screen map runs locally **and** on a Vercel preview URL.

### Phase 1: Map and stops
- Full-screen Leaflet map on the homepage, centered on the continental US.
- Sidebar: trip settings (dates, budget, MPG, travelers, cold threshold, default nightly rate).
- "Add stop" search box: geocode the place, drop a pin, set arrive and depart dates.
- Stops list: reorder by drag, edit, delete. Sort by date by default.
- Save the trip to `localStorage`.
- **Done when:** you can add 5 stops with dates, refresh the page, and they're still there.

### Phase 2: Accounts and shared trip (Supabase)
- **Auth:** sign in with Google (user decision, October 11, 2026), so there are no app passwords or SMTP provider to configure. This replaces the original email magic-link choice.
- **Tables:**
  - `trips`: trip settings from the data model, plus `owner_id`
  - `trip_members` (`trip_id`, `user_id`, `role`)
  - `stops`: one row per stop, with `trip_id`, `position`, and `updated_at`
  - `invites` (`code`, `trip_id`, `expires_at`)
- **Row-level security on every table:** a user can read and write a trip and its stops only if they're in `trip_members`.
- **Sharing:** the owner taps "Invite," which creates a share link (`/join/[code]`). The friend opens it, signs in, and gets added as a member.
- **Live sync:** subscribe to Supabase Realtime on `stops` and `trips` for the open trip, so an edit on one phone shows on the other within seconds. Last write wins per stop row, which is fine for two people.
- **Migration:** on first sign-in, if a trip exists in `localStorage`, offer to upload it, then stop using `localStorage` for trip data.
- **Done when:** two different accounts on two phones edit the same trip and each sees the other's changes without refreshing.

### Phase 3: Route
- For each consecutive pair of stops, call the routing API and draw the polyline on the map.
- Store miles and duration per leg. Show the total miles.
- Sample points along each polyline (for example, every ~5 miles) and use turf point-in-polygon against the states GeoJSON to compute `milesByState`.
- Store computed legs in a `legs` table keyed by the from/to coordinates. This keeps both phones from calling the routing API for the same leg.
- **Done when:** the route draws between stops and each leg shows miles broken down by state.

### Phase 4: Weather
- Toggleable OpenWeatherMap temperature tile overlay on the map, with a small legend.
- For each stop:
  - If arrival is more than 14 days away: pull historical monthly averages for that lat/lon (average over the last ~10 years for the stay's months).
  - If within 14 days: use the live forecast.
- Mark a stop **cold** when its average low is below `coldThresholdF`. The pin turns red (warm = green, borderline = yellow).
- For cold stops, compute `bestMonths` from the 12-month averages and show "Warmer in: Apr–Oct" with a one-click "move dates" suggestion.
- Cache climate results per lat/lon and month, since they don't change.
- **Done when:** a Denver stop in January shows red with suggested months; a Phoenix stop shows green.

### Phase 5: Budget
- **Gas:** fetch the latest weekly EIA retail regular gasoline prices (cache for 24h). For each leg: `Σ (milesInState / mpg × priceForState)`, falling back to the PADD region and then the national average.
- **Lodging:** `nights × (stop.nightlyRate ?? defaultNightlyRate)`.
- Budget panel: gas total, lodging total, grand total vs. `budgetTotal`, per-person split, and a remaining or over-budget indicator.
- Tapping a pin shows a popup with that stop's dates, weather, nights, lodging cost, and the gas cost of the leg into it.
- **Done when:** totals update live as you add, move, or edit stops.

### Phase 6: Polish and ship
- Installable PWA (manifest + icons) so it opens from the home screen like an app.
- Mobile-friendly layout (sidebar becomes a bottom sheet).
- Monthly timeline view: which stop you're at each month, colored by weather.
- Export the trip as JSON, plus an import option.
- Promote to production on Vercel and add a custom domain if wanted.
- Optional later: a seed table of typical lodging rates.

## Out of scope for v1
Booking hotels, real-time gas station prices, food and activities budgeting, flights.