# Audit environment only. This is not a production image or an AML pass gate.
# Official Node image index, verified 2026-10-21 in docker-library/repo-info.
FROM node:22-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9
ENV DEBIAN_FRONTEND=noninteractive \
    VIRTUAL_ENV=/opt/hawkeye-venv \
    PATH=/opt/hawkeye-venv/bin:$PATH \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright \
    CI=true
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git python3 python3-venv python-is-python3 \
      build-essential libffi-dev libssl-dev \
    && python3 -m venv /opt/hawkeye-venv \
    && rm -rf /var/lib/apt/lists/*
# OSS Scanner's contract requires the reviewed source checkout at /src.
COPY . /src
WORKDIR /src
# Setup is online; no live credentials or screening populations are supplied.
RUN python -m pip install --require-hashes -r ci/requirements.txt \
    && npm ci --ignore-scripts --no-audit --no-fund \
    && ./node_modules/.bin/playwright install --with-deps chromium firefox webkit
# Fail the build on any selected regression failure. No warning-only fallback.
# The network is disabled for these synthetic, offline regression suites.
RUN --network=none set -eu; \
    node test/sanctions-screen.test.mjs; \
    node test/screening-source-quality.test.mjs; \
    node test/adverse-media.test.mjs; \
    node test/runtime-recovery.test.mjs; \
    node test/employee-screening-wiring.test.mjs; \
    node test/screening-delivery.test.mjs; \
    node test/eocn-pdf-source-integrity.test.mjs; \
    python test/engine_test.py
ENTRYPOINT []
CMD ["/bin/bash"]
