# Vercel deployment

DiagramCloud V1.3 is a static Vite + React application. No server, database, or Vercel Function is required.

## One-time project creation

Import this branch into Vercel:

`https://github.com/julian-passebecq/diagramcloud/tree/feat/diagramcloud-v1.3-architecture-lab`

The repository contains `vercel.json`, so Vercel should use:

- Framework: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

No environment variables are required for the core DiagramCloud application.

## Optional Google Drive integration

Only configure these if Drive import/archive is wanted on the deployed site:

```
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_PICKER_API_KEY=...
VITE_GOOGLE_APP_ID=...
```

After Vercel assigns the production domain:

1. Add the exact production origin, for example `https://diagramcloud.vercel.app`, to the Google OAuth Web application's Authorized JavaScript origins.
2. Restrict the Picker API key to the production website origin and Google Picker API.
3. Keep OAuth client secrets out of Vercel and the browser bundle; DiagramCloud does not need one.
4. Redeploy after changing Vite environment variables.

Preview deployments use different hostnames. If Drive must work on previews, explicitly allow the relevant preview origins in Google Cloud; otherwise enable Drive only on production.

## Deployment verification

After deployment verify:

1. The Datapass architecture map loads.
2. Drill down: Foil data platform -> BigQuery historical analytics -> foil.telemetry_history -> Historical SQL task.
3. Explore/Edit/Portfolio/Present modes open.
4. PNG, SVG, HTML and PPTX export actions initialize successfully.
5. Browser refresh at the root loads normally.
6. If Google variables are configured, Project files -> Connect Google Drive is enabled.

## Git workflow

The current deployment-ready branch is:

`feat/diagramcloud-v1.3-architecture-lab`

PR #4 targets the V1.2 Drive branch. Once V1.3 is promoted to the repository production branch, Vercel Git integration can deploy every future production push automatically and create previews for feature branches.
