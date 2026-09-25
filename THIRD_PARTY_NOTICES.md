# Third-party notices

The root MIT license covers original DiagramCloud code. It does not relicense dependency code, provider trademarks, third-party artwork, fonts, user uploads or source portfolio documents. Retain upstream copyright and license notices when redistributing the built editor.

## Runtime dependencies

React and React DOM, Microsoft Fluent UI React components, React Flow (`@xyflow/react`), Zod, zod-to-json-schema and PptxGenJS are distributed under their upstream MIT licenses. DOMPurify offers MPL-2.0 OR Apache-2.0; this application uses the Apache-2.0 option. Build/test tools and transitive packages have their own terms. The generated `public/third-party-licenses.txt` inventories installed package versions and copies their available license/notice files; it is included in `dist/`. This is an attribution aid, not a legal compliance certification.

Sources:
- https://github.com/facebook/react
- https://github.com/microsoft/fluentui
- https://github.com/xyflow/xyflow
- https://github.com/colinhacks/zod
- https://github.com/StefanTerdell/zod-to-json-schema
- https://github.com/gitbrent/PptxGenJS
- https://github.com/cure53/DOMPurify

## Microsoft Fabric Lakehouse artwork

File: `public/icons/fabric-lakehouse.svg`.

Source package path: `FabricTools/fabric-icons/node_modules/@fabric-msft/svg-icons/svg/lakehouse_48_item.svg`.

Package: `@fabric-msft/svg-icons` 8.2.0. Repository commit: `e206270f367dc440b5bf6bc94f0f6267b922d596` (last change to this file, 2026-05-19).

Git blob: `a06e893bb2ecafcc6a563a607e7b4c2064b7a7d9`. The shipped file is byte-identical to the upstream file; the build recomputes this blob and fails if the file is changed. (An earlier version of this notice recorded `a06e6f9b…`, which was a transcription error; the upstream and committed blobs are both `a06e893b…`.)

Source: https://github.com/FabricTools/fabric-icons/blob/e206270f367dc440b5bf6bc94f0f6267b922d596/node_modules/@fabric-msft/svg-icons/svg/lakehouse_48_item.svg

The source repository's MIT licence covers that repository's own code, not Microsoft's artwork.

The artwork is Microsoft product iconography, not DiagramCloud artwork and not offered under this repository's MIT license. It is used to identify a Microsoft Fabric Lakehouse in architecture/educational diagrams. The Microsoft usage rules permit specified diagram/training/documentation uses and prohibit cropping, flipping, rotating or distorting the icons or using them as one's own product logo. Preserve the original artwork and label the represented Microsoft item.

Controlling usage terms and official collection: https://learn.microsoft.com/en-us/fabric/fundamentals/icons

The icon registry in `src/core/icons.ts` is the source of truth for every icon ID: a vendor icon is drawn only if it is registered with its source, version, blob and terms, and `scripts/icons.ts` fails the build for an unregistered or modified file in `public/icons`. Other symbols in `src/ui/Canvas.tsx` are original generic component symbols, not representations claimed to be official vendor logos. The activity animation surrounds the icon; it does not rotate the Microsoft artwork.

## Fonts and portfolio content

No font binaries are distributed. The UI uses installed system fonts; exported PowerPoint refers to fonts installed on the reader's machine and may substitute them. No font files may be added to an output archive without independently verified redistribution rights.

The portfolio sample descriptions derive from user-supplied PDFs. Raw PDFs and personal contact details were not added to this repository. Newly authored code, tables and financial illustrations carry explicit provenance labels and are not asserted to be confidential production data or verified employer outcomes. User-uploaded images remain subject to the uploader's rights and permissions.


## Google Identity Services / Google Picker / Google Drive API

DiagramCloud can optionally load Google-hosted Identity Services and Google Picker JavaScript at runtime and call Google Drive API endpoints after explicit user authorization. These Google services are not vendored into this MIT repository and are governed by Google's applicable API/service terms. DiagramCloud requests the per-file `drive.file` scope and keeps OAuth access tokens in browser memory only.
