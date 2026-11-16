const caches = new WeakMap();
const SNAPSHOT_TTL_MS = 60_000;
const MAX_SNAPSHOTS = 6;

const cacheFor = repository => {
  if (!caches.has(repository)) caches.set(repository, new Map());
  return caches.get(repository);
};

export const readSnapshot = (repository, key) => cacheFor(repository).get(key)?.snapshot;

export const loadSnapshot = (repository, key, load, force = false) => {
  const cache = cacheFor(repository);
  const entry = cache.get(key);
  if (entry?.pending) return entry.pending;
  if (!force && entry?.snapshot && Date.now() - entry.updatedAt < SNAPSHOT_TTL_MS) {
    return Promise.resolve(entry.snapshot);
  }
  const next = { ...entry };
  cache.delete(key);
  cache.set(key, next);
  while (cache.size > MAX_SNAPSHOTS) cache.delete(cache.keys().next().value);
  next.pending = Promise.resolve().then(load).then(snapshot => {
    next.snapshot = snapshot;
    next.updatedAt = Date.now();
    return snapshot;
  }).finally(() => { next.pending = null; });
  return next.pending;
};

export const clearSnapshots = repository => caches.delete(repository);
