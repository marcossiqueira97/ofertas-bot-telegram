FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY connectors/ ./connectors/
COPY apps/worker/ ./apps/worker/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vancod/database generate
RUN pnpm --filter @vancod/worker build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/connectors ./connectors
COPY --from=builder /app/apps/worker ./apps/worker

CMD ["node", "apps/worker/dist/index.js"]
