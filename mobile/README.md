# Re:Trace mobile (Expo) — #28

A React Native app for investigators: sign in, cases sorted by risk, a case with its evidence and the
explained risk score (with the disclaimer), and adding evidence. It uses the **same API client and types
as the web app** — `src/api.ts` imports `frontend/src/services/httpService.ts`; Metro watches that folder
(`metro.config.js`).

It is a separate npm package (not a workspace), so `npm install` at the root stays small.

## Run

```bash
npm start                       # in the repo root: API on http://localhost:3200
cd mobile && npm install
npx expo start                  # scan the QR code with Expo Go, or press i / a for a simulator
```

API address: `EXPO_PUBLIC_API_URL` (default `http://localhost:3200/api/v1`).

- iOS simulator: `localhost` works.
- Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3200/api/v1 npx expo start`.
- Phone with Expo Go: use the computer's LAN address, e.g. `http://192.168.1.20:3200/api/v1`.

Demo accounts (synthetic): `aigerim@retrace.test` / `demo-password`.

## Check

```bash
npm run typecheck    # TypeScript, including the shared web client
npm test             # unit tests
npm run bundle       # Metro bundles for iOS and Android (what CI runs)
```

## Limits

- The session is kept in memory: sign in again after restarting the app.
- No admin screens, attachments, graph or reports — use the web app for those.
- Not yet run on a physical device or simulator in this repository's checks (no Xcode on the
  development machine); CI proves it type-checks and bundles for both platforms.
