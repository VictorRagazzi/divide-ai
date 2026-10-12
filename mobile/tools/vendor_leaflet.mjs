// Keep Leaflet local: no third-party CDN script runs inside the map.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const base = new URL("../", import.meta.url);
const output = new URL("src/features/maps/generated/", base);
await mkdir(output, { recursive: true });
const js = await readFile(new URL("node_modules/leaflet/dist/leaflet.js", base), "utf8");
const css = await readFile(new URL("node_modules/leaflet/dist/leaflet.css", base), "utf8");
const license = await readFile(new URL("node_modules/leaflet/LICENSE", base), "utf8");
await writeFile(new URL("leaflet.json", output), JSON.stringify({ js, css, license }));
await writeFile(new URL("LICENSE.txt", output), license);
