// UI text (Russian) and small formatters for the mobile app.
import type { EvidenceType } from '../../frontend/src/services/types';

export const LEVEL: Record<'low' | 'medium' | 'high', string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
export const EVIDENCE_TYPE: Record<EvidenceType, string> = { message: 'Сообщение', link: 'Ссылка', account: 'Аккаунт', payment: 'Платёж', observation: 'Наблюдение' };
export const RULE_TITLE: Record<string, string> = {
  credential_request: 'Просят код, пароль, PIN или CVV',
  urgent_payment: 'Срочность вместе с требованием оплаты',
  remote_access: 'Просят установить программу удалённого доступа',
  suspicious_link: 'Подозрительная ссылка',
  personal_payment: 'Платёж на личную карту или кошелёк',
  fake_prize: 'Выигрыш или приз за «налог»',
  hub_entity: 'Сущность связана с тремя и более другими',
  disputed_evidence: 'Есть оспоренные доказательства',
};
export const DISCLAIMER = 'Это индикатор риска, а не доказательство мошенничества.';

export const ERRORS: Record<string, string> = {
  invalid_credentials: 'Неверный email или пароль',
  too_many_attempts: 'Слишком много неудачных попыток. Попробуйте через 15 минут.',
  account_disabled: 'Учётная запись отключена администратором',
  validation_error: 'Проверьте поля формы',
  case_locked: 'Дело закрыто для изменений',
  forbidden: 'Нет прав на это действие',
  network: 'Нет связи с сервером',
};
export const errorText = (code: string) => ERRORS[code] ?? 'Ошибка сервера. Повторите позже.';

export const money = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
export const riskColor = (level: 'low' | 'medium' | 'high') => ({ low: '#34d399', medium: '#fbbf24', high: '#f87171' })[level];
