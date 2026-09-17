const request = require('supertest');
const { app, wallets, idempotencyResponses } = require('../src/app');

describe('Transfer API', () => {
  const token = 'test-token';
  const auth = { Authorization: `Bearer ${token}` };

  beforeEach(() => {
    wallets.clear();
    idempotencyResponses.clear();
  });

  test('creates a wallet with zero balance', async () => {
    const res = await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(String),
      balanceKobo: 0,
    });
  });

  test('rejects unauthorized requests', async () => {
    const res = await request(app)
      .post('/wallets')
      .expect(401);

    expect(res.body).toMatchObject({
      error: 'Unauthorized',
      message: expect.any(String),
    });
  });

  test('credits a wallet and returns balance in kobo', async () => {
    const walletRes = await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201);

    const res = await request(app)
      .post(`/wallets/${walletRes.body.id}/credit`)
      .set(auth)
      .send({ amountKobo: 2500 })
      .expect(200);

    expect(res.body).toMatchObject({
      id: walletRes.body.id,
      balanceKobo: 2500,
    });
  });

  test('rejects invalid credit amounts and invalid wallets', async () => {
    const wallet = (await request(app).post('/wallets').set(auth).expect(201)).body;

    const invalidAmount = await request(app)
      .post(`/wallets/${wallet.id}/credit`)
      .set(auth)
      .send({ amountKobo: 0 })
      .expect(422);

    expect(invalidAmount.body.error).toBe('InvalidCredit');

    const missingWallet = await request(app)
      .get('/wallets/not-a-real-wallet')
      .set(auth)
      .expect(404);

    expect(missingWallet.body.error).toBe('WalletNotFound');
  });

  test('prevents negative balances on transfer', async () => {
    const source = (await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201)).body;
    const target = (await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201)).body;

    const res = await request(app)
      .post('/transfers')
      .set(auth)
      .set('Idempotency-Key', 'neg-1')
      .send({ fromWalletId: source.id, toWalletId: target.id, amountKobo: 100 })
      .expect(422);

    expect(res.body).toMatchObject({
      error: 'InvalidTransfer',
      message: expect.stringContaining('insufficient'),
    });
  });

  test('applies idempotency key for the same payload and rejects a different payload', async () => {
    const source = (await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201)).body;
    const target = (await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201)).body;

    await request(app)
      .post(`/wallets/${source.id}/credit`)
      .set(auth)
      .send({ amountKobo: 5000 })
      .expect(200);

    const first = await request(app)
      .post('/transfers')
      .set(auth)
      .set('Idempotency-Key', 'dup-1')
      .send({ fromWalletId: source.id, toWalletId: target.id, amountKobo: 2000 })
      .expect(200);

    const repeat = await request(app)
      .post('/transfers')
      .set(auth)
      .set('Idempotency-Key', 'dup-1')
      .send({ fromWalletId: source.id, toWalletId: target.id, amountKobo: 2000 })
      .expect(200);

    expect(repeat.body).toMatchObject(first.body);

    const conflict = await request(app)
      .post('/transfers')
      .set(auth)
      .set('Idempotency-Key', 'dup-1')
      .send({ fromWalletId: source.id, toWalletId: target.id, amountKobo: 2500 })
      .expect(409);

    expect(conflict.body).toMatchObject({
      error: 'IdempotencyKeyConflict',
      message: expect.stringContaining('different payload'),
    });

    const walletRes = await request(app)
      .get(`/wallets/${source.id}`)
      .set(auth)
      .expect(200);

    expect(walletRes.body.balanceKobo).toBe(3000);
  });

  test('enforces daily outbound transfer limit', async () => {
    const source = (await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201)).body;
    const target = (await request(app)
      .post('/wallets')
      .set(auth)
      .expect(201)).body;

    await request(app)
      .post(`/wallets/${source.id}/credit`)
      .set(auth)
      .send({ amountKobo: 600000 })
      .expect(200);

    await request(app)
      .post('/transfers')
      .set(auth)
      .set('Idempotency-Key', 'limit-1')
      .send({ fromWalletId: source.id, toWalletId: target.id, amountKobo: 500000 })
      .expect(200);

    const res = await request(app)
      .post('/transfers')
      .set(auth)
      .set('Idempotency-Key', 'limit-2')
      .send({ fromWalletId: source.id, toWalletId: target.id, amountKobo: 1 })
      .expect(422);

    expect(res.body).toMatchObject({
      error: 'DailyLimitExceeded',
      message: expect.stringContaining('500000'),
    });
  });

  test('security pass rejects missing or invalid bearer tokens and blocks injection-like strings', async () => {
    const wallet = (await request(app).post('/wallets').set(auth).expect(201)).body;

    const noToken = await request(app).post('/wallets').expect(401);
    expect(noToken.body.error).toBe('Unauthorized');

    const badToken = await request(app)
      .get(`/wallets/${wallet.id}`)
      .set('Authorization', 'Bearer bad-token')
      .expect(401);
    expect(badToken.body.error).toBe('Unauthorized');

    const injectionAttempt = await request(app)
      .post(`/wallets/${wallet.id}/credit`)
      .set(auth)
      .send({ amountKobo: "1 OR 1=1" })
      .expect(422);
    expect(injectionAttempt.body.error).toBe('InvalidCredit');

    const idInjection = await request(app)
      .post('/transfers')
      .set(auth)
      .set('Idempotency-Key', 'injection-1')
      .send({ fromWalletId: "' OR '1'='1", toWalletId: wallet.id, amountKobo: 1 })
      .expect(404);
    expect(idInjection.body.error).toBe('WalletNotFound');
  });

  test('concurrency test: concurrent transfers do not double-spend or create negative balances', async () => {
    const source = (await request(app).post('/wallets').set(auth).expect(201)).body;
    const target = (await request(app).post('/wallets').set(auth).expect(201)).body;

    await request(app)
      .post(`/wallets/${source.id}/credit`)
      .set(auth)
      .send({ amountKobo: 100000 })
      .expect(200);

    const requests = Array.from({ length: 12 }, (_, index) => (
      request(app)
        .post('/transfers')
        .set(auth)
        .set('Idempotency-Key', `concurrency-${index}`)
        .send({ fromWalletId: source.id, toWalletId: target.id, amountKobo: 10000 })
    ));

    const responses = await Promise.all(requests);
    const successCount = responses.filter((res) => res.status === 200).length;
    const totalTransferred = responses
      .filter((res) => res.status === 200)
      .reduce((sum, res) => sum + res.body.amountKobo, 0);

    const finalSource = (await request(app).get(`/wallets/${source.id}`).set(auth).expect(200)).body;
    const finalTarget = (await request(app).get(`/wallets/${target.id}`).set(auth).expect(200)).body;

    console.log('Concurrent transfer evidence', {
      successCount,
      totalTransferred,
      finalSourceBalanceKobo: finalSource.balanceKobo,
      finalTargetBalanceKobo: finalTarget.balanceKobo,
    });

    expect(finalSource.balanceKobo).toBeGreaterThanOrEqual(0);
    expect(finalSource.balanceKobo + finalTarget.balanceKobo).toBe(100000);
    expect(totalTransferred).toBeLessThanOrEqual(100000);
  });
});
