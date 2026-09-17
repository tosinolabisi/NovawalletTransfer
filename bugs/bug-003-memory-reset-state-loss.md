# Bug 003: Wallet state and idempotency data are lost on process restart

## Severity
Low

## Area
Persistence and operational resilience

## Description
The application stores wallet balances and transfer idempotency records in memory only. When the Node.js process exits or restarts, all wallet state is lost.

## Steps to reproduce
1. Create a wallet and credit it with funds.
2. Stop the API process.
3. Start the API again.
4. Query the old wallet ID or attempt to replay a prior idempotency key.
5. Observe that previous state is gone.

## Expected result
The system should either persist wallet balances and idempotency state to a durable store or clearly document that this is a short-lived local-only implementation.

## Actual result
State disappears immediately after process restart because the service uses in-memory maps only.

## Evidence
This is a design limitation visible during local operation and restart testing. The state is recreated from scratch, and previously created wallets are not preserved.

## Impact
Any restart causes data loss, making the system unsuitable for real production use or any scenario requiring reliable state retention.

## Proposed fix
Replace the in-memory Map with a persistent store such as a database or a file-backed state layer. Persist wallet balances and idempotency keys to durable storage with clear retention rules.

## Status
Accepted as a scope limitation of the lightweight local exercise. Not a blocker for the requested demo implementation.
