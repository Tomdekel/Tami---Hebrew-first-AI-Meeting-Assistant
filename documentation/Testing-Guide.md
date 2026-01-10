# Testing Guide

## Test types
- Unit tests: logic in AI helpers, parsers, and utils.
- API tests: validate API responses for core flows.
- E2E tests: full user flow via Playwright.

## What to prioritize
- Transcription status pipeline and error handling.
- Summarization and action item creation.
- Embedding generation and vector search.
- Entities + relationships extraction pipelines.

## Running tests
- E2E: `npm run test:e2e`.
- Headed E2E: `npm run test:e2e:headed`.

## Test data strategy
- Use small audio samples for deterministic ASR tests.
- Mock external APIs where possible in CI.
- Snapshot key API responses for regression detection.

---

If failures are flaky, isolate network dependencies first.
