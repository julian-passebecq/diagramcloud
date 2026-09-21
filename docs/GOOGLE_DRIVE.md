# Google Drive image assets

DiagramCloud V1.2 can use Google Drive as an **optional image asset vault**. Drive is not the project database and is not required for PowerPoint or HTML export.

## Security model

- DiagramCloud requests only `https://www.googleapis.com/auth/drive.file`.
- The browser receives a short-lived access token from Google Identity Services after an explicit user gesture.
- Access tokens are kept in JavaScript memory only. They are never written to project JSON, IndexedDB, localStorage or exported files.
- OAuth client ID, Picker API key and numeric project ID are browser configuration, not client secrets. Restrict the API key to the deployed site and Google Picker API.
- Drive file IDs, links and timestamps are **authoring-only metadata**. `publicDocument()` removes them from public JSON/SVG/HTML/PPTX payload preparation.
- Every imported Drive image is downloaded, decoded, raster-normalized and cached in the project. PPTX and standalone HTML use that cached copy and never fetch Drive during export.
- Image source files can be up to 8 MiB. The cached copy is resized/compressed to remain below the existing DiagramCloud embedded-asset ceiling.

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable **Google Drive API** and **Google Picker API**.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 **Web application** client.
5. Add each DiagramCloud origin to **Authorized JavaScript origins**, for example:
   - `http://localhost:5173`
   - the production DiagramCloud origin.
6. Create an API key for Picker and restrict it:
   - Application restriction: Websites.
   - Add the DiagramCloud site origin.
   - Add `https://docs.google.com/*` because Picker is rendered in a docs.google.com iframe.
   - API restriction: Google Picker API.
7. Copy the Google Cloud **project number** (not project name) for Picker's App ID.

Configure either build-time public variables or the local settings form:

```env
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_PICKER_API_KEY=...
VITE_GOOGLE_APP_ID=...
```

No Google client secret belongs in a Vite/browser bundle.

## User workflow

### Import an AI-created image already in Drive

1. Select the target DiagramCloud component.
2. Open **Drive assets**.
3. Connect Google Drive.
4. Choose provenance, normally **Synthetic / AI-generated**.
5. Click **Choose image from Drive**.
6. Pick PNG, JPEG or WebP.
7. DiagramCloud caches a sanitized copy and attaches an image evidence block to the selected component.

### Back up a local DiagramCloud image

1. Attach PNG/JPEG/WebP/SVG in the component Inspector.
2. Mark AI-created visuals as **Synthetic / AI-generated**.
3. Open **Drive assets** and connect.
4. Click **Back up to Drive** next to the cached asset.
5. On first upload DiagramCloud creates a `DiagramCloud Assets` folder and stores that folder ID in browser-local connector settings.

### Refresh from Drive

Use **Refresh cache** on a Drive-backed asset. The original DiagramCloud asset ID, rights and visibility are preserved while the cached image bytes and Drive metadata are refreshed.

## Export behavior

PowerPoint, HTML, SVG and public JSON do not require Google Drive access. The design is intentionally:

```text
Google Drive source / backup
          ↓ explicit import or refresh
sanitized local DiagramCloud asset
          ↓
HTML / PPTX / portfolio
```

This prevents token expiry, deleted Drive links or presentation-time connectivity from breaking an interview deck.

## CSP

The hosted app permits only the Google origins required by Identity Services, Picker and Drive REST. Standalone exported HTML remains offline with `connect-src 'none'`.

## Current boundary

V1.2 does not generate images itself. AI image generation can happen in ChatGPT or another image tool, after which the PNG can be uploaded to Drive or attached locally. A future image-generation provider should plug into the same asset-normalization contract rather than bypass it.
