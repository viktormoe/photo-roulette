# Minimal PocketBase image (official docs style)
FROM alpine:3.20

ARG PB_VERSION=0.31.0

RUN apk add --no-cache unzip ca-certificates

# download and unzip PocketBase (amd64 build as per docs)
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ \
 && rm /tmp/pb.zip \
 && chmod +x /pb/pocketbase

# optional: migrations / hooks
# COPY ./pb_migrations /pb/pb_migrations
# COPY ./pb_hooks /pb/pb_hooks

EXPOSE 8080

# start PocketBase (store data under /pb/pb_data)
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb/pb_data"]
