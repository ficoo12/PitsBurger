import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/testDatabaseUrl.js";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/globalSetup.ts"],
    // Values the app reads from process.env while tests run. These win over
    // .env because dotenv never overwrites a variable that's already set.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
    },
    // All test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
