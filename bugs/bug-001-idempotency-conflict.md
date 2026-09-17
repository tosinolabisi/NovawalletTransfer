# Bug 001: Idempotency key reused with a different payload is accepted

## Severity
High

## Area
Transfer idempotency handling

## Description
The API previously accepted a second transfer using the same Idempotency-Key when the request payload differed from the original request. This creates a risk of unintended duplicate or conflicting transfer behavior.

## Steps to reproduce
1. Create two wallets with enough funds.
2. Send a transfer with Idempotency-Key = K and payload P1.
3. Send a second transfer with the same Idempotency-Key = K but payload P2.
4. Observe the second request is accepted instead of rejected.

## Expected result
The API should reject the second request with a 409 Conflict response and a message indicating the Idempotency-Key was already used with a different payload.

## Actual result
The API returned the old successful transfer response for the same key, even when the payload differed.

## Evidence
This was reproduced in the automated test that checks the same key with the same payload and the same key with a different payload. The second request must fail; the implementation originally did not enforce that rule.

## Impact
If clients accidentally reuse an idempotency key for a different operation, the API can silently perform a conflicting transfer instead of rejecting it. This can lead to financial errors and broken client retry logic.

## Proposed fix
Store both the response and a payload signature associated with each Idempotency-Key. When the same key is replayed, compare the current payload signature with the stored value; if they differ, reject with 409 instead of replaying the old response.

## Status
Fixed in implementation and validated by automated tests.
