import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npm start -- -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    env: {
      ...process.env,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "build-validation-only",
    },
    timeout: 60_000,
  },
});
