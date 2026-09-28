import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://flos:flos@localhost:5432/flos_test",
      CLERK_SECRET_KEY: "sk_test_dummy",
      CLERK_PUBLISHABLE_KEY: "pk_test_dummy",
    },
  },
});
