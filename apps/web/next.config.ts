import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@flos/api-client", "@flos/types", "@flos/ui"],
};

export default withSentryConfig(nextConfig, { silent: true });
