# AI Usage Log

## Tools used

This project was developed and validated with the following tools:

- VS Code workspace tools for file creation and project setup
- Terminal for dependency installation, local execution, and verification
- Jest for automated unit/integration-style API testing
- Supertest for HTTP request validation against the Express app
- Newman for collection-based API smoke testing
- GitHub Actions workflow configuration for CI automation
- File-based documentation and repo state management

## Example prompts used

### Prompt 1
"Build a lightweight API that is easy to run locally and easy to test/automate. Implement a small Transfer API with wallet creation, crediting, transfers, idempotency, daily outbound limits, authentication, validation, and consistent error handling."

### Prompt 2
"Add automated functional, security, concurrency, and idempotency tests for the transfer API. Include evidence-based assertions and a concurrency test that proves no negative balance or double-spend occurs."

### Prompt 3
"Create a ready-to-import Postman collection, a Newman smoke runner, an OpenAPI spec, and a CI workflow for the API, and verify the full suite passes locally."

## Notes

These prompts were used to guide the implementation, validation, and documentation of the wallet transfer API exercise. The objective was to keep the project lightweight, reproducible, and easy to run in a local development environment while still supporting automated testing and CI coverage.
