# Bug Log

This folder contains one markdown file per bug discovered during testing.

## Current bug list

- [Bug 001: Idempotency key reused with a different payload is accepted](bug-001-idempotency-conflict.md)
- [Bug 002: Wallet access is not scoped to a real owner or user context](bug-002-wallet-authorization-gap.md)
- [Bug 003: Wallet state and idempotency data are lost on process restart](bug-003-memory-reset-state-loss.md)

## Status legend

- Fixed: bug has been corrected and validated
- Open: bug remains and needs architectural or product-level remediation
- Scope limitation: bug is accepted as a deliberate constraint of the lightweight local exercise
