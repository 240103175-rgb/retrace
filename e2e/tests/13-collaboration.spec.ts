// #127 sharing with an editor and a viewer; viewer read-only; editor adds evidence; edit conflict.
import { expect, signIn, test } from '../fixtures';

test('owner shares a case; roles are enforced in the UI', async ({ browser, api }) => {
  const owner = await api.newUser('owner');
  const editor = await api.newUser('editor');
  const viewer = await api.newUser('viewer');
  const c = await api.createCase(owner, 'Совместное расследование');
  await api.addEvidence(owner, c.id, { content: 'Исходное сообщение' });

  const ownerPage = await (await browser.newContext()).newPage();
  await signIn(ownerPage, owner.email, owner.password, `/cases/${c.id}`);
  const members = ownerPage.getByTestId('members');
  await expect(members).toContainText('Дело видно только вам.');
  for (const [who, role] of [[editor, 'editor'], [viewer, 'viewer']] as const) {
    await members.getByLabel('Email следователя').fill(who.email);
    await members.getByLabel('Роль нового участника').selectOption(role);
    await members.getByRole('button', { name: 'Добавить участника' }).click();
    await expect(members).toContainText(who.name);
  }

  const viewerPage = await (await browser.newContext()).newPage();
  await signIn(viewerPage, viewer.email, viewer.password);
  await expect(viewerPage.getByText(/Совместное: .* \(Наблюдатель\)/)).toBeVisible();
  await viewerPage.goto(`/cases/${c.id}?tab=evidence`);
  await expect(viewerPage.getByText('Вы наблюдатель: дело можно только просматривать.')).toBeVisible();
  await expect(viewerPage.getByRole('button', { name: /^\+ Добавить$/ })).toHaveCount(0);

  const editorPage = await (await browser.newContext()).newPage();
  await signIn(editorPage, editor.email, editor.password, `/cases/${c.id}?tab=evidence`);
  await expect(editorPage.getByText(/Вы редактор/)).toBeVisible();
  await expect(editorPage.getByLabel('Статус')).toHaveCount(0);
  await editorPage.getByRole('button', { name: /^\+ Добавить$/ }).click();
  await editorPage.locator('form.subpanel').getByLabel('Содержание').fill('Дополнение редактора');
  await editorPage.locator('form.subpanel').getByRole('button', { name: 'Сохранить' }).click();
  await expect(editorPage.getByTestId('evidence-row')).toHaveCount(2);

  // Both open the same evidence; the editor saves first, the owner gets a conflict.
  await ownerPage.goto(`/cases/${c.id}?tab=evidence`);
  const ownerRow = ownerPage.getByTestId('evidence-row').filter({ hasText: 'Исходное сообщение' });
  await ownerRow.getByRole('button', { name: 'Изменить' }).click();
  const editorRow = editorPage.getByTestId('evidence-row').filter({ hasText: 'Исходное сообщение' });
  await editorRow.getByRole('button', { name: 'Изменить' }).click();
  await editorPage.locator('form.subpanel').getByLabel('Содержание').fill('Правка редактора');
  await editorPage.locator('form.subpanel').getByRole('button', { name: 'Сохранить' }).click();
  await expect(editorPage.getByText('Правка редактора')).toBeVisible();

  await ownerPage.locator('form.subpanel').getByLabel('Содержание').fill('Правка владельца');
  await ownerPage.locator('form.subpanel').getByRole('button', { name: 'Сохранить' }).click();
  await expect(ownerPage.getByText(/Запись только что изменил другой участник/)).toBeVisible();
  await ownerPage.locator('form.subpanel').getByRole('button', { name: 'Сохранить' }).click();
  await expect(ownerPage.getByText('Правка владельца')).toBeVisible();
});
