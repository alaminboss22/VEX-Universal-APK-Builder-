# VEX Universal APK Builder — Frontend Starter

A mobile-first frontend starter for the VEX Universal APK Builder project.

## Included
- Responsive dashboard and sidebar navigation
- ZIP project selection with browser-side extension and size checks
- Build configuration UI for debug/release, APK/AAB, and architecture
- Build progress, logs, history, settings, and help pages
- Explicit preview-mode notices; no fake build output

## Run locally
Extract the project and open `index.html` in a modern browser. You can also serve it with `python -m http.server 8080`.

## Important limitations
This is frontend only. It does not upload files to a server, inspect ZIP contents, detect project types, execute builds, authenticate users, sign APKs, or provide downloads. Backend integration and secure isolated build workers are required.
