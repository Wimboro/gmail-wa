import test from 'node:test';
import assert from 'node:assert/strict';

test('configuration module loads', async () => {
  const mod = await import('../config/constants.js');
  assert.ok(mod.CONFIG);
  assert.equal(typeof mod.validateConfig, 'function');
});

test('main entry exports', async () => {
  const mod = await import('../src/index.js');
  assert.equal(typeof mod.main, 'function');
});

test('email processor exports processing helpers', async () => {
  const mod = await import('../src/processors/emailProcessor.js');
  assert.equal(typeof mod.processAllAccounts, 'function');
});
