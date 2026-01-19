# syntax=docker/dockerfile:1

FROM golang:1.25-alpine AS builder

WORKDIR /app

# Download dependencies with cache mount
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=bind,source=go.mod,target=go.mod \
    --mount=type=bind,source=go.sum,target=go.sum \
    go mod download -x

# Build the application with bind mount and cache
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=cache,target=/root/.cache/go-build/ \
    --mount=type=bind,target=. \
    go build -ldflags="-s -w" -o /bin/stream-server ./cmd/server

# Production stage
FROM alpine:latest

RUN apk add --no-cache ffmpeg ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/stream-server .

EXPOSE 8080 1935

CMD ["./stream-server"]