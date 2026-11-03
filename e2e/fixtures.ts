// Shared helpers: every test makes its own investigator and data through the API, so specs are
// independent and can run in parallel against any stack. The UI is driven only through Playwright.
import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'demo-password';
export const ADMIN = { email: 'admin@retrace.test', password: process.env.ADMIN_PASSWORD || DEMO_PASSWORD };
export const PASSWORD = 'e2e-password-1';

export interface Account {
  email: string;
  password: string;
  name: string;
  token: string;
  id: number;
}

let counter = 0;
export const uid = () => `${Date.now().toString(36)}${process.pid.toString(36)}${(counter++).toString(36)}`;

export class Api {
  constructor(private readonly request: APIRequestContext) {}

  async call<T = any>(method: string, path: string, token?: string, data?: unknown): Promise<T> {
    const res = await this.request.fetch(`/api/v1${path}`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      data,
    });
    if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
    return res.status() === 204 ? (undefined as T) : res.json();
  }

  /** A fresh investigator account for one test. */
  async newUser(prefix = 'e2e'): Promise<Account> {
    const email = `${prefix}-${uid()}@retrace.test`;
    const name = `Тест ${prefix} ${uid().slice(-4)}`;
    const s = await this.call('POST', '/auth/register', undefined, { email, password: PASSWORD, name });
    return { email, password: PASSWORD, name, token: s.token, id: s.user.id };
  }

  async login(email: string, password: string) {
    return (await this.call('POST', '/auth/login', undefined, { email, password })).token as string;
  }

  createCase(a: Account, title = `Дело ${uid()}`, description = 'Создано e2e-тестом') {
    return this.call('POST', '/cases', a.token, { title, description });
  }
  addEvidence(a: Account, caseId: number, body: Record<string, unknown>) {
    return this.call('POST', `/cases/${caseId}/evidence`, a.token, { type: 'message', ...body });
  }
  addEntity(a: Account, caseId: number, type: string, label: string) {
    return this.call('POST', `/cases/${caseId}/entities`, a.token, { type, label });
  }
  link(a: Account, caseId: number, sourceId: number, targetId: number, type = 'contacted', evidenceIds: number[] = []) {
    return this.call('POST', `/cases/${caseId}/relationships`, a.token, { sourceId, targetId, type, evidenceIds });
  }
}

/** Signs in through the login form. */
export async function signIn(page: Page, email: string, password: string, next = '/cases') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[?]/g, '\\?')));
}

/** A scam case with typical evidence: credential request, short link, personal payment. */
export async function scamCase(api: Api, a: Account) {
  const c = await api.createCase(a, `Мошенничество ${uid()}`, 'Покупатель просил код из SMS');
  const msg = await api.addEvidence(a, c.id, { content: 'Срочно пришлите код из SMS, иначе заказ отменится', source: 'WhatsApp', verification: 'confirmed', observedOn: '2026-10-20' });
  const link = await api.addEvidence(a, c.id, { type: 'link', content: 'http://bit.ly/olx-pay-kz', observedOn: '2026-10-21' });
  const pay = await api.addEvidence(a, c.id, { type: 'payment', content: 'Перевод на карту частного лица', amount: 45000, observedOn: '2026-10-22' });
  return { c, msg, link, pay };
}

export const test = base.extend<{ api: Api }>({
  api: async ({ request }, use) => use(new Api(request)),
});
export { expect };
