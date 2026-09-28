# Build from the repo root:  docker build -f apps/api/Dockerfile -t flos-api .
# Same image runs the API (default) and the worker (command: node dist/worker.js).
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@flos/api..."
RUN pnpm --filter @flos/db generate && pnpm --filter @flos/api build
# Workspace code is bundled into dist/, so the runtime only needs the API's own
# production npm dependencies. `pnpm deploy` extracts exactly those (~300 MB vs 1.6 GB).
RUN pnpm --filter @flos/api deploy --prod --legacy --ignore-scripts /prod/api

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
