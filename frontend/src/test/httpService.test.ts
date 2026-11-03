import { describe, expect, it, vi } from 'vitest';
import { createHttpService } from '../services/httpService';

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('httpService (#17)', () => {
  it('sends the bearer token and JSON body', async () => {
    const fetchMock = vi.fn(() => json(201, { id: 9 }));
    const api = createHttpService('/api/v1', fetchMock as unknown as typeof fetch);
    api.setToken('tok');
    await api.createEvidence(1, { type: 'message', content: 'x' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/cases/1/evidence');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ type: 'message', content: 'x' });
  });

  it('maps API errors and network failures', async () => {
    const locked = createHttpService('/api/v1', (() => json(409, { error: { code: 'case_locked', message: 'x' } })) as unknown as typeof fetch);
    await expect(locked.createEntity(1, { type: 'person', label: 'x' })).rejects.toMatchObject({ code: 'case_locked', status: 409 });
    const dead = createHttpService('/api/v1', (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch);
    await expect(dead.listCases()).rejects.toMatchObject({ code: 'network' });
  });

  it('handles 204 and builds query strings from present filters only', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const api = createHttpService('/api/v1', fetchMock as unknown as typeof fetch);
    await expect(api.deleteEntity(1, 2)).resolves.toBeUndefined();
    const list = vi.fn(() => json(200, []));
    const api2 = createHttpService('/api/v1', list as unknown as typeof fetch);
    await api2.listCases({ status: 'open', q: '' });
    expect((list.mock.calls[0] as unknown as [string])[0]).toBe('/api/v1/cases?status=open');
  });
});
