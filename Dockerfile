# Re:Trace in one image (#106): the React build is served as static files by the Express API.

# --- 1. Build the frontend --------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --no-audit --no-fund
# The frontend mock imports the shared domain code from backend/src.
COPY backend/src backend/src
COPY frontend frontend
RUN npm run build

# --- 2. Runtime: backend production dependencies + static files -------------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3200
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace backend --no-audit --no-fund && npm cache clean --force
COPY backend/src backend/src
COPY backend/scripts backend/scripts
COPY --from=build /app/frontend/dist frontend/dist
# SQLite (when DATABASE_URL is not PostgreSQL) writes to backend/data; owned by the unprivileged user.
RUN mkdir -p backend/data && chown -R node:node backend/data
USER node
WORKDIR /app/backend
EXPOSE 3200
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3200)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
