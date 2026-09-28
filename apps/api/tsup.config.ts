import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/worker.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Workspace packages ship TypeScript source, so bundle them; their npm deps stay external.
  noExternal: [/^@flos\//],
  external: ["pg", "@prisma/client", "@prisma/adapter-pg"],
  // Lets any bundled CommonJS code call require() inside the ESM output.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
