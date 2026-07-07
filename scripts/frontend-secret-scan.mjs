import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = [
  "apps/web/src",
  "apps/web/dist",
  "apps/admin/src",
  "apps/admin/dist"
];
const directFiles = ["apps/web/vite.config.ts", "apps/admin/vite.config.ts"];
const privateValue = process.env.SUPABASE_SERVICE_ROLE_KEY;
const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  ...(privateValue ? [privateValue] : [])
];
const scannedExtensions = new Set([
  ".html",
  ".js",
  ".css",
  ".map",
  ".json",
  ".ts",
  ".tsx"
]);
const matches = [];

const candidates = [...directFiles];
for (const root of roots) {
  candidates.push(...(await filesBelow(root)));
}
for (const file of candidates) {
  if (!scannedExtensions.has(extname(file))) {
    continue;
  }
  const contents = await readFile(file, "utf8");
  if (forbidden.some((value) => contents.includes(value))) {
    matches.push(file);
  }
}

if (matches.length > 0) {
  console.error(`Frontend secret scan failed in ${matches.join(", ")}`);
  process.exitCode = 1;
} else {
  console.info("Frontend secret scan passed.");
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesBelow(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}
