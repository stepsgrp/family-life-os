import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The monorepo keeps one .env at the root.
config({ path: "../../.env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx src/seed.ts" },
  // `prisma generate` doesn't need a database (CI, Docker builds), so don't hard-fail here;
  // migrate/studio will error clearly if the URL is really missing.
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://placeholder@localhost:5432/placeholder" },
});
