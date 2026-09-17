# Exploratory Testing Session Log

Date: 2026-09-17
Session timebox: 45 minutes
Scope: local wallet transfer API validation of auth, transfer logic, idempotency, input validation, and concurrency behavior.

## Session log

1. Setup and smoke test
   - Started the app locally on port 3000.
   - Verified the health path and wallet creation flow with valid bearer authentication.
   - Confirmed the API responds with JSON payloads and HTTP errors in the expected shape.

2. Functional validation
   - Created wallets, credited them, and verified balances are tracked in kobo.
   - Confirmed transfer logic rejects insufficient-funds cases and prevents negative balances.
   - Re-tested daily outbound cap logic and confirmed the limit resets via the WAT timezone-based day key.

3. Idempotency validation
   - Replayed the same Idempotency-Key with the same payload to ensure the original response is returned.
   - Replayed the same Idempotency-Key with a different payload to confirm the request is rejected instead of silently allowing a second transfer.

4. Security pass
   - Tried missing bearer tokens and invalid bearer tokens.
   - Sent malformed/injection-like data to credit endpoints and transfer payloads.
   - Confirmed the app rejects invalid token cases and rejects malformed amounts early.

5. Concurrency probe
   - Fired 12 concurrent transfer requests against one source wallet while the source had exactly enough funds for a subset of them.
   - Collected observable evidence: maximum transferred amount matched the source balance; final balance never went negative; total outbound amount did not exceed the starting balance.

## Real issues found

### Bug 1: Idempotency collision with different payloads
- Severity: High
- Area: Transfer idempotency handling
- Description: Before the fix, if the same Idempotency-Key was reused with a different payload, the API would return the prior response instead of rejecting the conflict.
- Evidence: The automated test `applies idempotency key for the same payload and rejects a different payload` failed before the fix and passed after the change.
- Status: Fixed.

### Bug 2: Cross-wallet access is not scoped by user/owner
- Severity: Medium
- Area: Authorization boundary
- Description: With a valid bearer token, any caller can read or credit any wallet by guessed wallet ID because there is no wallet ownership or user mapping.
- Evidence: Valid token + known wallet ID successfully accessed another wallet resource; no ownership check exists in the endpoint logic.
- Status: Documented as a security gap for production hardening.

### Bug 3: In-memory state resets on process restart
- Severity: Low / operational
- Area: Persistence and resilience
- Description: Wallet balances and transfer history are held only in memory. A server restart wipes balances and idempotency keys.
- Evidence: State disappears immediately after process exit and restart.
- Status: Accepted for this lightweight local-only API; not a defect for the current scope, but a production limitation.

## Summary

The API meets the local functional requirements and the automated regression suite verifies the key behaviors. The main remaining gap is that wallet-level authorization is not modeled beyond a shared bearer token, which should be addressed before production deployment.
