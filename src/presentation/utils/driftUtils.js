/**
 * Utilities for computing drift between spec.forProvider (desired) and status.atProvider (observed)
 * on Crossplane managed resources.
 */

/**
 * Line-level LCS diff between two arrays of strings.
 * Returns array of { type: 'same'|'removed'|'added', line: string }
 * 'removed' = only in A (forProvider/desired)
 * 'added'   = only in B (atProvider/actual)
 */
export function lcsLineDiff(aLines, bLines) {
  const m = aLines.length;
  const n = bLines.length;

  // Build LCS DP table
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff
  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.unshift({ type: 'same', line: aLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', line: bLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', line: aLines[i - 1] });
      i--;
    }
  }
  return result;
}

/**
 * Deep-diff two objects, returning an array of change entries.
 * Each entry: { path: string, type: 'changed'|'added'|'removed', forValue, atValue }
 */
export function computeDrift(forProvider, atProvider, path = '') {
  const results = [];

  if (forProvider === null || forProvider === undefined) return results;
  if (atProvider === null || atProvider === undefined) {
    // Everything in forProvider is missing from atProvider
    collectAll(forProvider, path, 'removed', results);
    return results;
  }

  const forType = getType(forProvider);
  const atType = getType(atProvider);

  if (forType !== atType) {
    results.push({ path: path || '(root)', type: 'changed', forValue: forProvider, atValue: atProvider });
    return results;
  }

  if (forType === 'object') {
    const allKeys = new Set([...Object.keys(forProvider), ...Object.keys(atProvider)]);
    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      const inFor = Object.prototype.hasOwnProperty.call(forProvider, key);
      const inAt = Object.prototype.hasOwnProperty.call(atProvider, key);

      if (inFor && !inAt) {
        collectAll(forProvider[key], childPath, 'removed', results);
      } else if (!inFor && inAt) {
        collectAll(atProvider[key], childPath, 'added', results);
      } else {
        const childResults = computeDrift(forProvider[key], atProvider[key], childPath);
        results.push(...childResults);
      }
    }
    return results;
  }

  if (forType === 'array') {
    // Compare element-by-element up to the longer length
    const maxLen = Math.max(forProvider.length, atProvider.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${path || '(root)'}[${i}]`;
      if (i >= forProvider.length) {
        collectAll(atProvider[i], childPath, 'added', results);
      } else if (i >= atProvider.length) {
        collectAll(forProvider[i], childPath, 'removed', results);
      } else {
        const childResults = computeDrift(forProvider[i], atProvider[i], childPath);
        results.push(...childResults);
      }
    }
    return results;
  }

  // Primitive comparison
  if (forProvider !== atProvider) {
    results.push({ path: path || '(root)', type: 'changed', forValue: forProvider, atValue: atProvider });
  }

  return results;
}

function getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function collectAll(value, path, type, results) {
  if (value === null || value === undefined || typeof value !== 'object') {
    results.push({ path, type, forValue: type === 'removed' ? value : undefined, atValue: type === 'added' ? value : undefined });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectAll(item, `${path}[${i}]`, type, results));
    return;
  }
  for (const key of Object.keys(value)) {
    collectAll(value[key], path ? `${path}.${key}` : key, type, results);
  }
}

/**
 * Returns true if the resource has both spec.forProvider and status.atProvider
 * and they differ.
 */
export function hasDrift(fullResource) {
  if (!fullResource) return false;
  const forProvider = fullResource.spec?.forProvider;
  const atProvider = fullResource.status?.atProvider;
  if (forProvider === undefined || forProvider === null) return false;
  if (atProvider === undefined || atProvider === null) return false;
  const diffs = computeDrift(forProvider, atProvider);
  return diffs.length > 0;
}

/**
 * Returns the drift entries or [] if either side is missing.
 */
export function getDriftEntries(fullResource) {
  if (!fullResource) return [];
  const forProvider = fullResource.spec?.forProvider;
  const atProvider = fullResource.status?.atProvider;
  if (forProvider === undefined || forProvider === null) return [];
  if (atProvider === undefined || atProvider === null) return [];
  return computeDrift(forProvider, atProvider);
}
