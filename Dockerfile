FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o bin/stream-server ./cmd/server

FROM alpine:latest

RUN apk add --no-cache ffmpeg ca-certificates

WORKDIR /app

COPY --from=builder /app/bin/stream-server .
COPY api/openapi.yaml ./api/

RUN mkdir -p media/hls

EXPOSE 8080 1935

CMD ["./stream-server"]