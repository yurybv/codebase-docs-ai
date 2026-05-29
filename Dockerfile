FROM node:20.10.0-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

FROM base AS build

ARG VITE_WEB_API_BASE_URL=http://localhost:3000
ENV VITE_WEB_API_BASE_URL=$VITE_WEB_API_BASE_URL

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM build AS api

ENV NODE_ENV=production
ENV API_PORT=3000
ENV DOCS_AI_TMP_DIR=/data/codebase-docs-ai

EXPOSE 3000
VOLUME ["/data/codebase-docs-ai"]

CMD ["pnpm", "--filter", "@codebase-docs-ai/api", "start"]

FROM build AS web

ENV NODE_ENV=production
ENV WEB_PORT=5173

EXPOSE 5173

CMD ["pnpm", "--filter", "@codebase-docs-ai/web", "preview"]
