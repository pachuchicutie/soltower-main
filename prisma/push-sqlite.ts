import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const schemaPath = "prisma/schema.prisma";
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const reset = process.argv.includes("--reset");

function resolveSqlitePath(url: string): string {
  if (!url.startsWith("file:")) {
    throw new Error("Only SQLite file: DATABASE_URL values are supported by this local helper");
  }
  const filePath = url.slice("file:".length);
  if (isAbsolute(filePath)) {
    return filePath;
  }
  return resolve(join("prisma", filePath));
}

function hasTables(databasePath: string): boolean {
  if (!existsSync(databasePath)) {
    return false;
  }
  const result = spawnSync("sqlite3", [databasePath, ".tables"], { encoding: "utf8" });
  if (result.status !== 0) {
    return false;
  }
  return result.stdout.trim().length > 0;
}

const databasePath = resolveSqlitePath(databaseUrl);
mkdirSync(dirname(databasePath), { recursive: true });

if (reset && existsSync(databasePath)) {
  unlinkSync(databasePath);
}

if (hasTables(databasePath)) {
  console.info(`SQLite database already has tables: ${databasePath}`);
  process.exit(0);
}

const diffOutput = execFileSync(
  "pnpm",
  ["exec", "prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"],
  {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl }
  }
);
const firstCreate = diffOutput.indexOf("-- CreateTable");
if (firstCreate === -1) {
  throw new Error("Prisma did not produce a create-table SQL script");
}

const sql = diffOutput.slice(firstCreate);
const sqlite = spawnSync("sqlite3", [databasePath], { input: sql, encoding: "utf8" });
if (sqlite.status !== 0) {
  throw new Error(sqlite.stderr || "sqlite3 failed to apply schema");
}

console.info(`SQLite schema applied: ${databasePath}`);
