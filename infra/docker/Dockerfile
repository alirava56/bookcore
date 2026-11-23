FROM node:22.23.5-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY apps ./apps
COPY scripts ./scripts
COPY db ./db
RUN npm run build

FROM node:22.23.5-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --system --uid 10001 bookcore
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/db ./db
USER bookcore
EXPOSE 3000
CMD ["node", "dist/apps/api/src/main.js"]
