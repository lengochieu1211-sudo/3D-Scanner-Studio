# 3D Scanner Studio v0.5.1 - GitHub Actions build fix

## Fixed
- Added `src/vite-env.d.ts` with Vite client type declarations.
- Fixes GitHub Actions TypeScript error TS2882 for side-effect import `./style.css` from `src/main.tsx`.
- Bumped package version from 0.5.0 to 0.5.1.
- Existing UI, camera, tracking, IndexedDB, PWA and multi-device logic are otherwise unchanged.

## GitHub Desktop update
1. Extract this FULL SOURCE ZIP.
2. Copy all files/folders inside it into the existing `3d-scanner-studio` local repository and choose Replace when Windows asks.
3. GitHub Desktop -> Summary: `Fix Vite CSS types v0.5.1`.
4. Commit to main -> Push origin.
5. GitHub -> Actions and wait for the new run.
