# Vercel deployment

DiagramCloud is a static Vite + React application. No server, database, or Vercel Function is required.

## One-time project creation

Import the repository into Vercel with `main` as the production branch:

`https://github.com/julian-passebecq/diagramcloud`

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

The release check is in [RELEASE.md](RELEASE.md) ("Static deployment check"). After a deployment, for the exact commit:

1. The gallery loads; TotalEnergies drills SQL quality checks → Required fields with the parent view kept.
2. `?project=total-project-controls&view=validation&node=mandatory` opens with its parent context.
3. Explore/Edit/Portfolio/Present modes open.
4. PNG, SVG, HTML and PPTX exports download.
5. `galaxy/version-handshake.json` reports the expected `product_version` and `galaxy_level: G0`.
6. If Google variables are configured, Project files -> Connect Google Drive is enabled.

## Git workflow

`main` is the production branch: every push to `main` deploys to production, and pull requests get preview deployments. Feature branches are merged into `main` through pull requests after CI passes (see [RELEASE.md](RELEASE.md)).
