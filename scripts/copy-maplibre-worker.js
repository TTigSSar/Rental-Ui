#!/usr/bin/env node
// Copies MapLibre's tile worker to public/map/maplibre-gl-worker.js (gitignored; see
// shared/ui/map/map.component.ts). The package ships it as `.mjs`, but nginx:alpine's
// mime.types serves only `.js` as JavaScript, and a module worker is refused with any other
// MIME type -- so it is copied under a `.js` name. Angular asset entries cannot rename, hence
// this script, run by the prestart/prebuild/pretest/prewatch hooks.
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const dest = path.join(__dirname, '..', 'public', 'map', 'maplibre-gl-worker.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
