# syntax=docker/dockerfile:1

FROM golang:1.26.5-alpine3.24 AS builder

WORKDIR /app

# Download dependencies with cache mount
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=bind,source=go.mod,target=go.mod \
    --mount=type=bind,source=go.sum,target=go.sum \
    go mod download -x

COPY . .

# Build the application with cache
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=cache,target=/root/.cache/go-build/ \
    go build -ldflags="-s -w" -o /bin/stream-server ./cmd/server

# Production stage
FROM alpine:3.24.1

RUN apk add --no-cache ffmpeg ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/stream-server .

EXPOSE 8080 1935

CMD ["./stream-server"]
