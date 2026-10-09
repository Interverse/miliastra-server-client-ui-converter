# Miliastra UI GIA Converter

Static, browser-only conversion between Server and Client UI control templates. No build step, backend, CDN, or runtime dependencies. All application paths are relative, including template fetches, so GitHub Pages repository subpaths work.

## Run locally

From the repository root:

```sh
python -m http.server 8000
```

Open http://localhost:8000/. Serve over HTTP rather than opening `index.html` as a file, because the converter fetches binary templates.

## GitHub Pages

Commit the root `index.html`, `.nojekyll`, `css/`, `js/`, and `assets/` (along with this README and LICENSE). In the repository's Pages settings, publish from your branch's **root** directory. No build command is needed. The handoff folder is excluded by `.gitignore`; the deployed site never reads it.

## Supported input

- One `.gia` file containing one or multiple independent control groups. No application-imposed file-size or image-count cap.
- Image groups using the supplied Server/Client component profiles.
- Mixed text box / image groups, including the supplied scoreboard (67 text boxes and 16 images), in both directions. Container hierarchies and all four platform layouts are preserved.
- UI Animation and Fullscreen UI Animation, including standalone controls and animation asset groups. Asset IDs and playback flags are preserved.
- Client control types are identified by their components. Controls without a mapped Server equivalent are listed and conversion is blocked; they are never silently dropped.
- Centered anchors/pivots and four independently preserved platform transforms. Image scale and full X/Y/Z rotation are preserved; container translation is supported.
- Image names (resource and component names separately), custom asset IDs, ARGB tint, fractional/negative positions, Z rotation, and painter order.
- Transparent rectangular or elliptical Client parents, masks on or off, and the historical Client container without an image parent.
- Rectangular or elliptical Server masks; Classic/Beyond mode is preserved.

Files with broken references, duplicate IDs, unsupported components/settings, visible Client parents, nested masks, or incompatible transforms are rejected. The reference Server template itself contains stale child links; it is used only for target metadata, never treated as a valid import. The direct import writer rebuilds its hierarchy correctly.

Conversion validates the input envelope and hierarchy, checks source components against canonical template profiles, rebuilds IDs and relationships, and compares normalized output content before exposing a download. Templates supply target-specific metadata. Importing the results in the game editor is still required to confirm in-game rendering; automated checks cannot establish that.

## Preferences

Dark theme by default; theme uses `theme` in localStorage. All 15 languages use the supplied runtime and shared `miliastra-lang` preference, including canonical `zhs`/`zht` mapping and live synchronization between tabs on the same origin. Files stay local.

## Verification

```sh
node tests/converter.cjs
node tests/file-size.cjs
node tests/custom-assets.cjs
node tests/platform-layouts.cjs
node tests/parent-mask.cjs
node tests/multi-groups.cjs
node tests/controls.cjs
node tests/animations.cjs
```

Browser checks require the `playwright` Node package and Chrome (or `CHROME_PATH` pointing to another Chromium executable). Start `python -m http.server 8321 --bind 127.0.0.1` first, then run:

```sh
node tests/browser.cjs
```

Browser checks cover upload, verified download, invalid files, failed template fetches, theme persistence, language synchronization, and mobile overflow. Screenshots and downloaded fixtures go to the ignored `test-results/` directory.

The copied library also passed the handoff's 667-check Client regression suite and Server byte-parity suite. The handoff is needed only to rerun those original regression suites, not to run the website or its own tests.

## Attribution

Its MIT license and attribution are preserved in `LICENSE`. Converter-specific additions are in `js/converter.js` and `js/control-converter.js`, `js/import-profiles.js`, `js/app.js`, `js/converter-locales.js`, and `css/converter.css`. Library changes are limited to strict tag/varint checks, diagnostic profiles, and opt-in imported-name and packed-hierarchy preservation; the original generation arithmetic and binary templates are retained.

Multi-group exports preserve each independent parent, mask and image hierarchy. Conversion assigns globally unique GUIDs and writes all converted groups into one output `.gia`; the interface lists all group names and the total image count.
