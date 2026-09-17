# Nova Wallet Transfer API

![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)

A lightweight local wallet API built for quick local runs and simple automation.

## Features

- Wallet creation with zero starting balance
- Wallet crediting in integer kobo
- Atomic transfers between wallets
- Balance protection against negative values
- Bearer authentication using a hardcoded token
- Idempotency protection for transfer requests
- Daily outbound limit per wallet with WAT reset at midnight (UTC+1)
- Consistent JSON error responses and HTTP status codes

## Run locally

```bash
npm install
npm start
```

The service listens on port 3000 by default.

## Test

```bash
npm test
```

## Example requests

```bash
curl -X POST http://localhost:3000/wallets \
  -H "Authorization: Bearer test-token"

curl -X POST http://localhost:3000/wallets/1/credit \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"amountKobo":2500}'

curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer test-token" \
  -H "Idempotency-Key: abc123" \
  -H "Content-Type: application/json" \
  -d '{"fromWalletId":"wallet-a","toWalletId":"wallet-b","amountKobo":1500}'
```

## Authentication

Use the mock bearer token:

```text
test-token
```

## Test coverage and Postman collection

The project includes automated coverage for:

- functional happy paths and negative checks
- idempotency replay behavior
- security and auth validation
- concurrency checks against a single source wallet

A ready-to-import Postman collection is included at [nova-wallet-transfer-api.postman_collection.json](nova-wallet-transfer-api.postman_collection.json).

## Notes

The API keeps state in memory only, so it resets whenever the Node process restarts.
