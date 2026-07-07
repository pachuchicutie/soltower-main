import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "es2022",
  dts: true,
  sourcemap: true,
  outDir: "dist",
  noExternal: ["@soltower/shared", "@soltower/game-engine"]
});
