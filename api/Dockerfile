# syntax=docker/dockerfile:1

# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copy source and build
# VITE_API_BASE_URL is intentionally empty — same-origin relative paths
COPY index.html vite.config.js eslint.config.js ./
COPY src ./src
RUN npm run build

# ── Stage 2: Build Go backend ─────────────────────────────────────────────────
FROM golang:1.24-alpine AS backend-builder
WORKDIR /build

COPY api/go.mod api/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY api/ .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o wordcore-api .

# ── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM alpine:3.21
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy Go binary
COPY --from=backend-builder /build/wordcore-api .

# Copy built frontend into static/ — Go will serve this
COPY --from=frontend-builder /app/dist ./static

EXPOSE 8080
ENV TZ=Asia/Shanghai
ENV PORT=8080
ENV STATIC_DIR=/app/static

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["./wordcore-api"]
