# OSS Scanner preparation

Status: NOT ENROLLED. These files prepare a source-code security audit only.
They do not install an AML data provider or make Screening Assurance pass.

The linked trex0092/oss-scanner repository is a fork of Anthropic's enrollment
registry, not a reusable GitHub Action or an executable AML scanner. Do not
vendor that registry or its projects into this application.

## Authorization and eligibility hold

HAWKEYE's LICENSE is proprietary. Anthropic describes this service as an
opt-in program for eligible open-source projects, with case-by-case acceptance.
The owner must resolve licensing/eligibility with the provider and approve the
service terms before upstream submission. No license change is implied here.
The example stays disabled and no enrollment request has been submitted.
The contact is the existing public reporting address from SECURITY.md.

## Validate the build

Use a clean, reviewed main checkout with no live state or credentials:

```sh
docker build -f .oss-scanner/Dockerfile -t hawkeye-security-audit .
docker run --rm --network=none --cap-drop=ALL \
  --security-opt=no-new-privileges hawkeye-security-audit \
  node test/screening-source-quality.test.mjs
```

The Dockerfile runs seven JavaScript suites and the Python engine suite with
network disabled. Any failure fails the build. Package and browser downloads
happen only during setup. Never pass tokens or mount operational state.
Passing these tests verifies this audit environment, not live AML assurance.

## Submit only after approval

After this preparation is merged and its Docker build validated, and after
the owner has resolved the authorization, terms and eligibility hold, copy
project.yaml.example to projects/hawkeye-sterling-ra/project.yaml in the
oss-scanner fork. The Dockerfile and threat model live in HAWKEYE, so do not
also copy them alongside that registration. Set disabled: false only with
owner approval, run tools/validate.py and tools/check hawkeye-sterling-ra,
then submit an enrollment PR to anthropics/oss-scanner.
A PR in the fork alone does not enroll HAWKEYE. Provider acceptance, completed
scans and reviewed findings must each be verified separately. Do not claim
scheduled frequency, a vulnerability-free result or automatic AML approval.

References, reviewed 2026-10-21:
- https://github.com/trex0092/oss-scanner/blob/main/README.md
- https://github.com/anthropics/oss-scanner
- https://red.anthropic.com/oss-scanner/
- https://red.anthropic.com/oss-scanner/terms/
