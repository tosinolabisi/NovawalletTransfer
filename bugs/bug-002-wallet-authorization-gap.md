# Bug 002: Wallet access is not scoped to a real owner or user context

## Severity
Medium

## Area
Authorization and wallet access control

## Description
The API currently authenticates with a single shared bearer token, but it does not enforce wallet ownership or a user-specific access model. A valid token can access any wallet ID by guessing or knowing the ID.

## Steps to reproduce
1. Create wallet A and wallet B.
2. Obtain the valid bearer token.
3. Call GET /wallets/{walletB-id} using the same token even though the caller is not associated with wallet B.
4. Observe the request succeeds.

## Expected result
The service should enforce wallet ownership or user scoping so that one caller cannot access or manipulate another caller's wallet unless explicitly authorized.

## Actual result
Any caller with the shared bearer token can read or act on any wallet ID without additional authorization checks.

## Evidence
This was observed during the security pass. The app validates the token but does not bind that token to a wallet owner or user context.

## Impact
This is a real authorization gap. In a production system, it could allow unauthorized access to funds or account data through ID guessing or enumeration.

## Proposed fix
Introduce a user or wallet owner model, store wallet ownership in the data layer, and validate that the authenticated caller is permitted to access the requested wallet before allowing read or credit/transfer actions.

## Status
Documented as a security gap for a production-grade implementation. This exercise intentionally keeps the auth model minimal and shared-token based.
