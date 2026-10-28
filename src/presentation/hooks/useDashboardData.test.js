import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import { build } from 'esbuild';
import { KubernetesApiRepository } from '../../data/repositories/KubernetesApiRepository.js';

const require = createRequire(import.meta.url);

async function loadWithHooks(entry, appContext = {}) {
  const slots = [];
  let cursor = 0;
  let effect;
  let dependencies;
  let cleanup;
  const hooks = {
    createContext: () => ({}),
    useContext: () => appContext.dashboardData,
    useMemo: callback => callback(),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value;
      }];
    },
    useEffect(callback, next) {
      if (!dependencies || next.some((value, index) => value !== dependencies[index])) {
        effect = callback;
        dependencies = next;
      }
    },
  };
  const result = await build({
    entryPoints: [new URL(entry, import.meta.url).pathname],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    packages: 'external',
    external: ['test-hooks', 'test-app'],
    plugins: [{
      name: 'hook-test',
      setup(builder) {
        builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'test' }));
        builder.onResolve({ filter: /AppProvider\.jsx$/ }, () => ({ path: 'app', namespace: 'test' }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({
          contents: path === 'app'
            ? 'export const useAppContext = () => require("test-app");'
            : 'export const { createContext, useState, useEffect, useContext, useMemo } = require("test-hooks");',
        }));
      },
    }],
  });
  const module = { exports: {} };
  const mockedRequire = name => name === 'test-hooks' ? hooks : name === 'test-app' ? appContext : require(name);
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(mockedRequire, module, module.exports);
  return {
    exports: module.exports,
    render(callback) {
      cursor = 0;
      const result = callback(module.exports);
      if (effect) {
        cleanup?.();
        const callback = effect;
        effect = null;
        cleanup = callback();
      }
      return result;
    },
    dispose() { cleanup?.(); },
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const definition = {
  spec: {
    group: 'example.org',
    versions: [{ name: 'v1' }],
    names: { kind: 'Example', plural: 'examples' },
    claimNames: { kind: 'ExampleClaim', plural: 'exampleclaims' },
  },
};
const resource = (index, namespace = 'team') => ({
  metadata: { name: `resource-${index}`, namespace, creationTimestamp: '2026-10-28T00:00:00Z' },
  status: { conditions: [{ type: 'Ready', status: 'True' }] },
});

test('one shared load lists each composite/claim type once, follows pages, and keeps complete aggregates', async () => {
  const calls = [];
  const repository = {
    async getResources(apiVersion, kind, namespace, context, limit, token) {
      calls.push({ kind, context, limit, token });
      if (kind === 'CompositeResourceDefinition') return { items: [definition] };
      return token
        ? { items: Array.from({ length: 60 }, (_, i) => resource(i + 60)) }
        : { items: Array.from({ length: 60 }, (_, i) => resource(i)), continueToken: 'next' };
    },
  };
  const harness = await loadWithHooks('./useDashboardData.js');
  const render = () => harness.render(({ useDashboardData }) => useDashboardData(repository, 'cluster'));
  assert.equal(render().compositeResources.loading, true);
  await flush();
  const data = render();
  assert.equal(data.compositeResources.items.length, 120);
  assert.equal(data.claims.items.length, 120);
  for (const kind of ['Example', 'ExampleClaim']) {
    assert.deepEqual(calls.filter(call => call.kind === kind).map(call => call.token), [null, 'next']);
  }
  assert.ok(calls.every(call => call.limit === null));
  for (let i = 0; i < 5; i++) render();
  assert.equal(calls.length, 6, 'consumer rerenders must not refetch');
  harness.dispose();
});

test('context changes and disposal ignore late responses and clear stale resources immediately', async () => {
  const pending = new Map();
  const repository = {
    async getResources(apiVersion, kind, namespace, context) {
      if (kind === 'CompositeResourceDefinition') return { items: [definition] };
      return new Promise(resolve => pending.set(`${context}/${kind}`, resolve));
    },
  };
  const harness = await loadWithHooks('./useDashboardData.js');
  const render = context => harness.render(({ useDashboardData }) => useDashboardData(repository, context));
  render('old');
  await flush();
  render({ name: 'new' });
  await flush();
  for (const kind of ['Example', 'ExampleClaim']) pending.get(`new/${kind}`)({ items: [resource(2)] });
  await flush();
  assert.equal(render('new').claims.items[0].name, 'resource-2');
  for (const kind of ['Example', 'ExampleClaim']) pending.get(`old/${kind}`)({ items: [resource(1)] });
  await flush();
  assert.equal(render('new').claims.items[0].name, 'resource-2');
  const cleared = render(null);
  assert.deepEqual(cleared.claims.items, []);
  assert.equal(cleared.claims.loading, false);
  render('disposed');
  await flush();
  harness.dispose();
  for (const kind of ['Example', 'ExampleClaim']) pending.get(`disposed/${kind}`)({ items: [resource(3)] });
  await flush();
  assert.deepEqual(render(null).claims.items, []);
  harness.dispose();
});

test('composite widgets can finish while claims are still loading', async () => {
  let discovery = 0;
  let resolveClaims;
  const repository = {
    async getResources(apiVersion, kind) {
      if (kind === 'CompositeResourceDefinition') {
        if (++discovery === 2) return new Promise(resolve => { resolveClaims = resolve; });
        return { items: [definition] };
      }
      return { items: [resource(1)] };
    },
  };
  const harness = await loadWithHooks('./useDashboardData.js');
  const render = () => harness.render(({ useDashboardData }) => useDashboardData(repository, 'cluster'));
  render();
  await flush();
  assert.equal(render().compositeResources.loading, false);
  assert.equal(render().compositeResources.items.length, 1);
  assert.equal(render().claims.loading, true);
  resolveClaims({ items: [] });
  await flush();
  assert.equal(render().claims.loading, false);
  harness.dispose();
});

test('shared dataset failures are explicit and do not discard the other successful dataset', async () => {
  let discovery = 0;
  const repository = {
    async getResources(apiVersion, kind) {
      if (kind === 'CompositeResourceDefinition') {
        if (++discovery === 2) throw new Error('Claims forbidden');
        return { items: [definition] };
      }
      return { items: [resource(0)] };
    },
  };
  const harness = await loadWithHooks('./useDashboardData.js');
  const render = () => harness.render(({ useDashboardData }) => useDashboardData(repository, 'cluster'));
  render();
  await flush();
  const data = render();
  assert.equal(data.compositeResources.items.length, 1);
  assert.match(data.claims.error, /Claims forbidden/);
  assert.equal(data.claims.loading, false);
  harness.dispose();
});

test('managed count widget requests limit=1 and displays totalCount, not returned items length', async () => {
  const calls = [];
  const repository = new KubernetesApiRepository();
  repository.request = async endpoint => {
    calls.push(endpoint);
    return { items: [resource(1)], totalCount: 11340 };
  };
  const context = {
    selectedContext: 'in-cluster',
    kubernetesRepository: repository,
  };
  const harness = await loadWithHooks('../components/widgets/ManagedResourcesCountWidget.jsx', context);
  const render = () => harness.render(({ ManagedResourcesCountWidget }) => ManagedResourcesCountWidget());
  render();
  await flush();
  assert.deepEqual(calls, ['/managed?context=in-cluster&limit=1']);
  const tree = render();
  assert.ok(tree.props.children.some(child => child.props.children === 11340));
  harness.dispose();
});

test('health and namespace widgets count the full shared dataset, beyond the old preview limits', async () => {
  const items = Array.from({ length: 120 }, (_, index) => ({
    name: `resource-${index}`, namespace: 'team',
    conditions: [{ type: 'Ready', status: 'True' }],
  }));
  const dashboardData = {
    compositeResources: { items, loading: false, error: null },
    claims: { items, loading: false, error: null },
  };
  const textValues = tree => {
    if (tree === null || tree === undefined) return [];
    if (Array.isArray(tree)) return tree.flatMap(textValues);
    if (typeof tree !== 'object') return [tree];
    return textValues(tree.props?.children);
  };
  for (const widget of ['ResourceHealth', 'NamespaceDistribution']) {
    const harness = await loadWithHooks(`../components/widgets/${widget}Widget.jsx`, { dashboardData });
    const tree = harness.render(exports => exports[`${widget}Widget`]());
    assert.ok(textValues(tree).includes(240), `${widget} must include all 240 resources`);
    harness.dispose();
  }
});

test('managed count zero and request failure are not confused', async () => {
  const repository = { getManagedResources: async () => ({ items: [], totalCount: 0 }) };
  const context = { selectedContext: 'cluster', kubernetesRepository: repository };
  const harness = await loadWithHooks('../components/widgets/ManagedResourcesCountWidget.jsx', context);
  const render = () => harness.render(({ ManagedResourcesCountWidget }) => ManagedResourcesCountWidget());
  render();
  await flush();
  assert.ok(render().props.children.some(child => child.props.children === 0));
  repository.getManagedResources = async () => { throw new Error('Forbidden'); };
  context.selectedContext = 'other';
  render();
  await flush();
  assert.ok(render().props.children.some(child => child.props.children === 'Error loading'));
  harness.dispose();
});

test('all composite and claim widgets use the shared context instead of issuing their own requests', async () => {
  for (const name of ['ResourceHealth', 'NamespaceDistribution', 'RecentActivity', 'CompositeResources', 'ClaimsCount']) {
    const source = await readFile(new URL(`../components/widgets/${name}Widget.jsx`, import.meta.url), 'utf8');
    assert.match(source, /useContext\(DashboardDataContext\)/);
    assert.doesNotMatch(source, /new Get(?:CompositeResources|Claims)UseCase/);
  }
  const dashboard = await readFile(new URL('../pages/Dashboard.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /useDashboardData\(kubernetesRepository, selectedContext\)/);
  assert.match(dashboard, /DashboardDataContext.Provider value=\{dashboardData\}/);
});
