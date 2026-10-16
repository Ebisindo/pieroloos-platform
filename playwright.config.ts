import { defineConfig } from "@playwright/test";

const port = 3100;
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL: origin },
  webServer: {
    command: `npm start -- -p ${port}`,
    url: origin,
    reuseExistingServer: true,
    env: {
      ...process.env,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "build-validation-only",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? origin,
    },
    timeout: 60_000,
  },
});
