# Self-hosting image: the same static tree Netlify publishes, served by
# static-web-server (a ~2 MB scratch-based static file server). For air-gapped
# or on-prem deployments; the Netlify site remains the reference deployment.
#
#   docker run -p 8080:8080 ghcr.io/trex0092/hawkeye-sterling-ra:latest
#
# The Netlify functions (Asana relay, AI brain, encrypted backup) do not exist
# in this image; the app detects their absence and degrades gracefully — the
# register, audit log, and assessments are on-device by design.
#
# Base is pinned by its multi-arch index digest (supply chain: no mutable tags).
FROM ghcr.io/static-web-server/static-web-server:2.44.0@sha256:2c1a7c3e0feaea5859307403b74e1c575f3ec1499094fc077344173d11abaae2

# Port 8080 (not 80) so the server can bind as non-root; SERVER_HEALTH exposes
# GET /health for orchestrator probes; sws.toml adds the same security headers
# the Netlify edge sets (CSP, HSTS, XFO, COOP/COEP/CORP — see that file).
ENV SERVER_ROOT=/public \
    SERVER_PORT=8080 \
    SERVER_HEALTH=true \
    SERVER_CONFIG_FILE=/sws.toml

COPY sws.toml /sws.toml

# Exactly the client runtime set (the three screens, their logic/styles, the
# PWA shell, and static assets) — no engine code, tests, docs, or data files.
COPY index.html console.html advisor.html \
     app.css console.css advisor.css fonts.css \
     app.js console.js advisor.js i18n.js sw.js sw-register.js \
     manifest.webmanifest /public/
COPY assets/ /public/assets/

# Drop root: numeric uid/gid (scratch base has no /etc/passwd to name a user);
# the COPY'd files are root-owned but world-readable, which is all a static
# server needs. No HEALTHCHECK on purpose — scratch ships no client binary to
# probe with; orchestrators should hit GET /health (enabled above) instead.
USER 65532:65532

EXPOSE 8080

LABEL org.opencontainers.image.title="Hawkeye Sterling — Entity Risk Assessment" \
      org.opencontainers.image.description="AML/CFT entity risk assessment command center for DPMS — static app, all data stays on-device" \
      org.opencontainers.image.vendor="Hawkeye Sterling" \
      org.opencontainers.image.licenses="LicenseRef-Proprietary" \
      org.opencontainers.image.source="https://github.com/trex0092/HAWKEYE-STERLING-RA"
