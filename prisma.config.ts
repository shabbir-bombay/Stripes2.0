import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Locally DATABASE_URL comes from .env; on AWS and in CI it is a real environment variable.
if (existsSync(".env")) process.loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
