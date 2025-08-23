FROM alpine:latest AS config-builder

RUN apk add --no-cache yq

COPY --from=bluenviron/mediamtx:1.14.0 /mediamtx.yml /tmp/mediamtx.yml
COPY mediamtx.override.yml /tmp/mediamtx.override.yml

RUN yq eval-all 'select(fileIndex == 0) * select(fileIndex == 1)' /tmp/mediamtx.yml /tmp/mediamtx.override.yml > /tmp/merged.yml

FROM bluenviron/mediamtx:1.14.0

COPY --from=config-builder /tmp/merged.yml /mediamtx.yml