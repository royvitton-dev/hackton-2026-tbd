FROM rust:1.98.1-bookworm AS builder
WORKDIR /build/engine
COPY engine/Cargo.toml engine/Cargo.lock ./
COPY engine/src ./src
RUN cargo build --release --locked --bin leave-engine

FROM debian:bookworm-slim
RUN mkdir -p /var/lib/leave-engine && chown 10001:10001 /var/lib/leave-engine
COPY --from=builder /build/engine/target/release/leave-engine /usr/local/bin/leave-engine
USER 10001:10001
ENV ENGINE_BIND=0.0.0.0:8787 ENGINE_DATA_DIR=/var/lib/leave-engine
VOLUME ["/var/lib/leave-engine"]
EXPOSE 8787
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/leave-engine"]
