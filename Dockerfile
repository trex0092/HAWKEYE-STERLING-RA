# Self-hosting image: the same static tree Netlify publishes, served by
# static-web-server (a ~2 MB scratch-based static file server). For air-gapped
# or on-prem deployments; the Netlify site remains the reference deployment.
#
#   docker run -p 8080:80 ghcr.io/trex0092/hawkeye-sterling-ra:latest
#
# The Netlify functions (Asana relay, AI brain, encrypted backup) do not exist
# in this image; the app detects their absence and degrades gracefully — the
# register, audit log, and assessments are on-device by design.
#
# Base is pinned by its multi-arch index digest (supply chain: no mutable tags).
FROM ghcr.io/static-web-server/static-web-server:2.43.0@sha256:6acea6260b14e08dda986361e42640082fbfaab8d88c327de532bb13a3b22994

ENV SERVER_ROOT=/public \
    SERVER_PORT=80

# Exactly the client runtime set (the three screens, their logic/styles, the
# PWA shell, and static assets) — no engine code, tests, docs, or data files.
COPY index.html console.html advisor.html \
     app.css console.css advisor.css fonts.css \
     app.js console.js advisor.js i18n.js sw.js sw-register.js \
     manifest.webmanifest /public/
COPY assets/ /public/assets/

EXPOSE 80

LABEL org.opencontainers.image.title="Hawkeye Sterling — Entity Risk Assessment" \
      org.opencontainers.image.description="AML/CFT entity risk assessment command center for DPMS — static app, all data stays on-device" \
      org.opencontainers.image.vendor="Hawkeye Sterling" \
      org.opencontainers.image.licenses="LicenseRef-Proprietary" \
      org.opencontainers.image.source="https://github.com/trex0092/HAWKEYE-STERLING-RA"
