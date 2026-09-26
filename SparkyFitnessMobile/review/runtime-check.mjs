// Expected synthetic 503 responses and blocked writes are not rendering errors.
export function assertRuntimeClean(log) {
  const failure = log.match(
    /Text strings must be rendered[^\n]*|Unconfigured review endpoint:[^\n]*|(?:^|\n)\s*ERROR\s+[^\n]+/
  );
  if (failure)
    throw new Error(`UI review runtime failure: ${failure[0].trim()}`);
}
