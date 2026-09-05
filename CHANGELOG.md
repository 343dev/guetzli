# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - Unreleased

### Added

- Added an asynchronous ESM API with TypeScript declarations, stable error codes, and a fresh Worker Thread for each encoding operation.
- Added a portable WebAssembly distribution compiled from Google Guetzli v1.0.1.
- Added standard-stream support, atomic file output, strict option parsing, and documented exit statuses to the CLI.
- Added pinned upstream provenance, reproducible build tooling, native/WebAssembly parity tests, and installed-tarball tests.

### Changed

- Raised the minimum Node.js version to 22.22.1.
- Replaced all platform-specific native executables with one committed wasm32 distribution.
- Changed the CLI memory-limit default to 3500 MiB and made the limit mandatory.

### Removed

- Removed PNG input support and the `--nomemlimit` option.
- Removed CommonJS and package subpath entry points.

## [1.3.0] - 2026-06-25

### Changed

- Removed the `postinstall` lifecycle script. Platform, CPU architecture, and binary presence are now validated at runtime in `index.js`, so the package no longer relies on install-time scripts (which npm is phasing out).

## [1.2.0] - 2026-01-02

### Changed

- Replaced Linux binaries to work with Alpine Linux without requiring `gcompat` package. The new binaries are built with musl libc compatibility, eliminating the need for glibc compatibility layer on Alpine systems.

## [1.1.0] - 2025-04-10

### Added

- `arm64` CPU architecture support.
- Support reading from stdin and writing to stdout ([#114](https://github.com/google/guetzli/pull/114), [#220](https://github.com/google/guetzli/pull/220)).

## [1.0.1] - 2024-10-22

### Fixed

- Run postinstall npm-script on Windows.

## [1.0.0] - 2024-10-22

### Added

- Init version.

