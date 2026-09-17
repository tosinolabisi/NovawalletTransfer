# Test Strategy

## Objective

This exercise validates a lightweight wallet transfer API built for local execution and automation. The goal is to verify the service is functionally correct, safe enough for basic use, and easy to test via both automated code-level tests and collection-based API checks.

The effort focuses on the behaviors explicitly requested for the assignment:

- wallet creation with zero starting balance
- integer kobo accounting
- balance protection against negative values
- atomic transfer execution
- bearer-token authentication
- idempotency keys for transfer requests
- a daily outbound transfer limit of ₦500,000/day
- midnight WAT reset behavior
- consistent HTTP status codes and JSON error responses
- validation of invalid inputs

## What we are testing

### 1. Functional correctness
We verify that each core endpoint behaves as expected:

- POST /wallets
  - creates a wallet
  - returns a stable wallet identifier
  - starts with balanceKobo = 0
- GET /wallets/{id}
  - returns the current wallet balance in kobo
  - returns 404 if the wallet does not exist
- POST /wallets/{id}/credit
  - accepts valid positive integers only
  - adds the amount to the wallet balance
  - rejects non-positive or invalid values
- POST /transfers
  - moves funds from one wallet to another
  - updates both balances atomically
  - rejects transfers that would create negative balances
  - enforces the daily outbound cap

### 2. Idempotency
We validate that repeated requests with the same Idempotency-Key and same payload return the same result rather than creating duplicate transfers. We also test the conflict case where the same key is reused with a different payload, ensuring the API rejects the second request with a clear error instead of silently executing a different transfer.

### 3. Security and authorization basics
We perform a focused authentication and input-validation pass:

- missing bearer token is rejected
- invalid bearer token is rejected
- attempts to access or manipulate resources without the expected token are stopped
- obvious injection-like payload values are rejected by validation logic
- wallet IDs are treated as strings and invalid IDs return not found style responses rather than executing business logic

### 4. Concurrency behavior
We run concurrent transfers against the same source wallet to check whether the implementation allows double-spend or negative balances. The test is evidence-based: we examine final balances and transfer totals to confirm the system does not overdraw the wallet under concurrent pressure.

### 5. Boundary/value checks
We verify the limiting behaviors around:

- zero or negative amounts
- very large valid amounts
- daily outbound quota exhaustion
- repeated replay of the same transfer idempotency key

## Why this is the right scope

This project is intentionally small and local-first. The test strategy is designed to validate important business rules and the most likely failure modes without turning the exercise into a broad security audit or a full production-grade banking platform review.

The emphasis is on evidence that the core requirements are implemented correctly and that the API is easy to automate with both code and collection-based checks.

## Test order

The test execution order is intentional:

1. Smoke and happy-path tests
   - confirm the service boots and the primary endpoints work
2. Validation and edge cases
   - check invalid input, zero values, and not-found behavior
3. Balance safety and transfer logic
   - verify atomicity and refusal of negative balances
4. Idempotency tests
   - confirm safe retry semantics and key conflict handling
5. Daily limit tests
   - validate outbound cap enforcement
6. Security pass
   - confirm bearer auth and basic input sanitization checks
7. Concurrency test
   - validate the service under concurrent transfer pressure
8. Postman/Newman smoke check
   - verify the collection-based API flow also works against the same service

This order catches basic wiring problems first, then deeper logic invariants, then security and concurrency concerns.

## Explicitly out of scope

This exercise does not attempt to cover the following:

- full production-grade PCI or banking compliance review
- distributed transactions or multiple service coordination
- real persistence, database migration, or backup/restore logic
- full penetration testing or adversarial fuzzing across the entire network boundary
- user identity, RBAC, or multi-tenant wallet ownership models
- wallet recovery, fraud alerts, chargebacks, or KYC checks
- local timezone handling beyond the specified WAT daily reset requirement
- long-term performance benchmarking under high throughput
- multi-process or multi-node clustering correctness

## Test artifacts used

The project includes the following automation artifacts:

- Jest suite for automated functional testing
- Newman smoke flow for collection-based API execution
- Postman collection covering the required sample requests and test scenarios
- CI workflow for automated execution on push and pull request

## Exit criteria

The test effort is considered successful when the automated suite verifies all required behaviors and the API consistently rejects invalid requests, prevents negative balances, enforces idempotency, and honors the daily limit without allowing double-spend.
