import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL is only needed for migrations (run locally).
    // prisma generate doesn't connect to the DB, so a placeholder is fine
    // for CI/Vercel builds where .env.local doesn't exist.
    url: process.env.DIRECT_URL || "postgresql://placeholder:5432/placeholder",
  },
});
