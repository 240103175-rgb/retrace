// Smoke test against a running server (#84): node scripts/smoke.mjs http://localhost:3200
const base = `${(process.argv[2] ?? 'http://localhost:3200').replace(/\/$/, '')}/api/v1`;
let token = null;

async function call(method, path, body, expect = [200, 201, 204]) {
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`${method} ${path}: cannot connect (${err.cause?.code ?? err.message})`);
  }
  const text = await res.text();
  if (!expect.includes(res.status)) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}

const steps = [];
const step = async (name, fn) => {
  const out = await fn();
  steps.push(name);
  return out;
};

try {
  const health = await step('health', () => call('GET', '/health'));
  token = (await step('login', () => call('POST', '/auth/login', { email: 'aigerim@retrace.test', password: 'demo-password' }))).token;
  const c = await step('create case', () => call('POST', '/cases', { title: `Smoke ${new Date().toISOString()}`, description: 'CI smoke test' }));
  const ev = await step('add evidence', () =>
    call('POST', `/cases/${c.id}/evidence`, { type: 'message', content: 'Срочно оплатите и пришлите код из SMS', source: 'smoke', verification: 'confirmed' }),
  );
  const a = await step('add entity A', () => call('POST', `/cases/${c.id}/entities`, { type: 'account', label: '@smoke_account' }));
  const b = await step('add entity B', () => call('POST', `/cases/${c.id}/entities`, { type: 'card', label: '4400 0000 0000 0000' }));
  await step('link', () => call('POST', `/cases/${c.id}/relationships`, { sourceId: a.id, targetId: b.id, type: 'owns', evidenceIds: [ev.id] }));
  const risk = await step('risk', () => call('GET', `/cases/${c.id}/risk`));
  if (risk.score < 60) throw new Error(`risk: expected a high score, got ${risk.score}`);
  await step('report', () => call('POST', `/cases/${c.id}/reports`));
  const exported = await step('export', () => call('GET', `/cases/${c.id}/export`));
  if (exported.evidence.length !== 1) throw new Error('export: expected 1 evidence');
  await step('archive', () => call('PATCH', `/cases/${c.id}`, { status: 'archived' }));
  await step('locked', () => call('POST', `/cases/${c.id}/evidence`, { type: 'observation', content: 'x' }, [409]));
  console.log(`smoke OK (${health.storage}): ${steps.join(' → ')}`);
} catch (err) {
  console.error(`smoke FAILED after [${steps.join(', ')}]: ${err.message}`);
  process.exit(1);
}
