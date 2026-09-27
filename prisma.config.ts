import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "Prisma/schema.prisma",
  migrations: {
    path: "Prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
