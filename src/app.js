const express = require('express');
const crypto = require('crypto');

const app = express();
const AUTH_TOKEN = 'test-token';
const DAILY_LIMIT_KOBO = 500000;
const WAT_TIMEZONE = 'Africa/Lagos';

const wallets = new Map();
const idempotencyResponses = new Map();

app.use(express.json());

function transferKeySignature({ fromWalletId, toWalletId, amountKobo }) {
  return `${String(fromWalletId)}|${String(toWalletId)}|${Number(amountKobo)}`;
}

function todayKeyInWat(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WAT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const lookup = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      lookup[part.type] = part.value;
    }
  }

  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function ensureWalletDayState(wallet) {
  const todayKey = todayKeyInWat();

  if (wallet.outboundDayKey !== todayKey) {
    wallet.outboundDayKey = todayKey;
    wallet.outboundDayTotalKobo = 0;
  }
}

function walletResponse(wallet) {
  return {
    id: wallet.id,
    balanceKobo: wallet.balanceKobo,
  };
}

function transferResponse(transfer) {
  return {
    id: transfer.id,
    fromWalletId: transfer.fromWalletId,
    toWalletId: transfer.toWalletId,
    amountKobo: transfer.amountKobo,
    status: transfer.status,
  };
}

function errorResponse(status, error, message) {
  return { status, error, message };
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || token !== AUTH_TOKEN) {
    return res.status(401).json(
      errorResponse(401, 'Unauthorized', 'A valid bearer token is required.')
    );
  }

  return next();
}

app.use(requireAuth);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/wallets', (req, res) => {
  const id = crypto.randomUUID();
  const wallet = {
    id,
    balanceKobo: 0,
    outboundDayKey: todayKeyInWat(),
    outboundDayTotalKobo: 0,
  };

  wallets.set(id, wallet);
  return res.status(201).json(walletResponse(wallet));
});

app.get('/wallets/:id', (req, res) => {
  const wallet = wallets.get(req.params.id);

  if (!wallet) {
    return res.status(404).json(
      errorResponse(404, 'WalletNotFound', 'Wallet was not found.')
    );
  }

  return res.status(200).json(walletResponse(wallet));
});

app.post('/wallets/:id/credit', (req, res) => {
  const wallet = wallets.get(req.params.id);

  if (!wallet) {
    return res.status(404).json(
      errorResponse(404, 'WalletNotFound', 'Wallet was not found.')
    );
  }

  const { amountKobo } = req.body || {};

  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return res.status(422).json(
      errorResponse(422, 'InvalidCredit', 'amountKobo must be a positive integer.')
    );
  }

  wallet.balanceKobo += amountKobo;
  return res.status(200).json(walletResponse(wallet));
});

app.post('/transfers', (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');

  if (!idempotencyKey || !idempotencyKey.trim()) {
    return res.status(422).json(
      errorResponse(422, 'IdempotencyKeyRequired', 'The Idempotency-Key header is required.')
    );
  }

  const { fromWalletId, toWalletId, amountKobo } = req.body || {};

  if (!fromWalletId || !toWalletId || typeof fromWalletId !== 'string' || typeof toWalletId !== 'string') {
    return res.status(422).json(
      errorResponse(422, 'InvalidTransfer', 'fromWalletId and toWalletId are required.')
    );
  }

  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return res.status(422).json(
      errorResponse(422, 'InvalidTransfer', 'amountKobo must be a positive integer.')
    );
  }

  const payloadSignature = transferKeySignature({ fromWalletId, toWalletId, amountKobo });

  if (idempotencyResponses.has(idempotencyKey)) {
    const stored = idempotencyResponses.get(idempotencyKey);
    if (stored.signature !== payloadSignature) {
      return res.status(409).json(
        errorResponse(409, 'IdempotencyKeyConflict', 'The Idempotency-Key was already used with a different payload.')
      );
    }
    return res.status(200).json(stored.response);
  }

  if (fromWalletId === toWalletId) {
    return res.status(422).json(
      errorResponse(422, 'InvalidTransfer', 'A wallet cannot transfer to itself.')
    );
  }

  const sourceWallet = wallets.get(fromWalletId);
  const targetWallet = wallets.get(toWalletId);

  if (!sourceWallet || !targetWallet) {
    return res.status(404).json(
      errorResponse(404, 'WalletNotFound', 'One or both wallets were not found.')
    );
  }

  ensureWalletDayState(sourceWallet);

  if (sourceWallet.balanceKobo < amountKobo) {
    return res.status(422).json(
      errorResponse(422, 'InvalidTransfer', 'Transfer rejected: insufficient funds in source wallet.')
    );
  }

  const outboundTotal = sourceWallet.outboundDayTotalKobo + amountKobo;
  if (outboundTotal > DAILY_LIMIT_KOBO) {
    return res.status(422).json(
      errorResponse(
        422,
        'DailyLimitExceeded',
        `Transfer exceeds the daily outbound limit of ${DAILY_LIMIT_KOBO} kobo.`
      )
    );
  }

  sourceWallet.balanceKobo -= amountKobo;
  targetWallet.balanceKobo += amountKobo;
  sourceWallet.outboundDayTotalKobo = outboundTotal;

  const transfer = {
    id: crypto.randomUUID(),
    fromWalletId,
    toWalletId,
    amountKobo,
    status: 'completed',
  };

  const response = transferResponse(transfer);
  idempotencyResponses.set(idempotencyKey, { response, signature: payloadSignature });

  return res.status(200).json(response);
});

app.use((req, res) => {
  res.status(404).json({ error: 'NotFound', message: 'Endpoint not found.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'InternalServerError', message: 'An unexpected error occurred.' });
});

module.exports = {
  app,
  wallets,
  idempotencyResponses,
  DAILY_LIMIT_KOBO,
  WAT_TIMEZONE,
  todayKeyInWat,
};
