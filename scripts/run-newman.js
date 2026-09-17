const path = require('path');
const { spawn } = require('child_process');
const newman = require('newman');

const projectRoot = path.resolve(__dirname, '..');
const collectionPath = path.join(projectRoot, 'nova-wallet-transfer-api.postman_collection.json');
const serverPort = process.env.PORT || '3101';
const token = 'test-token';

const collection = {
  info: {
    name: 'Nova Wallet Transfer API smoke suite',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'Create source wallet',
      event: [
        {
          listen: 'test',
          script: {
            exec: [
              "const res = JSON.parse(responseBody);",
              "if (res && res.id) { postman.setEnvironmentVariable('sourceWalletId', res.id); }",
              "pm.test('status is 201', () => pm.response.to.have.status(201));",
            ],
          },
        },
      ],
      request: {
        method: 'POST',
        header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        url: '{{baseUrl}}/wallets',
      },
    },
    {
      name: 'Create target wallet',
      event: [
        {
          listen: 'test',
          script: {
            exec: [
              "const res = JSON.parse(responseBody);",
              "if (res && res.id) { postman.setEnvironmentVariable('targetWalletId', res.id); }",
              "pm.test('status is 201', () => pm.response.to.have.status(201));",
            ],
          },
        },
      ],
      request: {
        method: 'POST',
        header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        url: '{{baseUrl}}/wallets',
      },
    },
    {
      name: 'Credit source wallet',
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{token}}' },
          { key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          mode: 'raw',
          raw: '{"amountKobo":5000}',
        },
        url: '{{baseUrl}}/wallets/{{sourceWalletId}}/credit',
      },
    },
    {
      name: 'Create valid transfer',
      request: {
        method: 'POST',
        header: [
          { key: 'Authorization', value: 'Bearer {{token}}' },
          { key: 'Idempotency-Key', value: 'newman-smoke-1' },
          { key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          mode: 'raw',
          raw: '{"fromWalletId":"{{sourceWalletId}}","toWalletId":"{{targetWalletId}}","amountKobo":1000}',
        },
        url: '{{baseUrl}}/transfers',
      },
    },
    {
      name: 'Get source wallet balance',
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
        url: '{{baseUrl}}/wallets/{{sourceWalletId}}',
      },
    },
  ],
};

const environment = {
  name: 'Nova Wallet Transfer API local env',
  values: [
    { key: 'baseUrl', value: `http://localhost:${serverPort}`, enabled: true },
    { key: 'token', value: token, enabled: true },
    { key: 'sourceWalletId', value: '', enabled: true },
    { key: 'targetWalletId', value: '', enabled: true },
  ],
};

const server = spawn('node', ['src/server.js'], {
  cwd: projectRoot,
  env: { ...process.env, PORT: serverPort },
  stdio: 'inherit',
});

let settled = false;

function finish(code = 0) {
  if (settled) return;
  settled = true;
  server.kill('SIGTERM');
  process.exit(code);
}

setTimeout(() => {
  newman.run({
    collection,
    environment,
    reporters: ['cli'],
    color: 'on',
  }, (err, summary) => {
    if (err) {
      console.error('Newman failed to run collection:', err);
      finish(1);
      return;
    }

    const failed = summary.run.failures.length;
    if (failed > 0) {
      console.error(`Newman found ${failed} failing requests.`);
      finish(1);
      return;
    }

    console.log('Newman smoke run passed.');
    finish(0);
  });
}, 500);

server.on('exit', (code) => {
  if (!settled && code !== 0 && code !== null) {
    console.error(`Server exited before the smoke suite finished (code ${code}).`);
    finish(1);
  }
});
