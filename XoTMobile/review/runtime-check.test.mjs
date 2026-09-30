import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRuntimeClean } from './runtime-check.mjs';
test('rejects rendering errors even when the expected metric is visible', () => {
  assert.throws(() =>
    assertRuntimeClean(
      '1.400 kcal\n ERROR Text strings must be rendered within a <Text> component.'
    )
  );
  assert.throws(() =>
    assertRuntimeClean('ERROR TypeError: cannot read property')
  );
});
test('unknown fixture routes fail instead of creating a loading screenshot', () => {
  assert.throws(() =>
    assertRuntimeClean('WARN Unconfigured review endpoint: /api/meals/recent')
  );
});
test('expected read-only and error fixtures do not hide unrelated failures', () => {
  assert.doesNotThrow(() =>
    assertRuntimeClean(
      'LOG [ERROR] Daily Summary API 503\nLOG [ERROR] Review is read-only'
    )
  );
});
