# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

