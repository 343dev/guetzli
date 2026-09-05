# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Asynchronous ESM API with TypeScript declarations and stable error codes.
- Worker Thread isolation with a fresh Worker and WebAssembly instance for each encoding operation.
- Platform-independent WebAssembly distribution built from Google Guetzli v1.0.1.
- CLI support for standard input and output, atomic file output, strict option parsing, and documented exit statuses.
- Pinned upstream provenance, reproducible build tooling, native/WebAssembly parity tests, and installed-package tests.

### Changed

- **Breaking:** Require Node.js 22.22.1 or later.
- **Breaking:** Replace platform-specific native executables with a single WebAssembly distribution.
- **Breaking:** Set the default memory limit to 3500 MiB and require a memory limit for every encoding operation.

### Removed

- **Breaking:** Remove PNG input support.
- **Breaking:** Remove the `--nomemlimit` CLI option.
- **Breaking:** Remove CommonJS and package subpath entry points.

## [1.3.0] - 2026-06-25

### Changed

- Remove the `postinstall` lifecycle script. Platform, CPU architecture, and executable availability are now validated at runtime, so installation no longer depends on lifecycle scripts.

## [1.2.0] - 2026-01-02

### Changed

- Replace the Linux executables with musl-compatible builds so Alpine Linux no longer requires the `gcompat` package.

## [1.1.0] - 2025-04-10

### Added

- Support ARM64 systems.
- Support reading from standard input and writing to standard output ([#114](https://github.com/google/guetzli/pull/114), [#220](https://github.com/google/guetzli/pull/220)).

## [1.0.1] - 2024-10-22

### Fixed

- Run the `postinstall` npm script on Windows.

## [1.0.0] - 2024-10-22

### Added

- Initial release.

[unreleased]: https://github.com/343dev/guetzli/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/343dev/guetzli/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/343dev/guetzli/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/343dev/guetzli/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/343dev/guetzli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/343dev/guetzli/releases/tag/v1.0.0
