import { createTranslator } from 'use-intl';
import en from '../messages/en.json';
import ptBR from '../messages/pt-BR.json';
import type { Locale } from './locale';
import { resolveMessage, type Translatable } from './message';
import type { Messages } from './messages';

const MESSAGES: Record<Locale, Messages> = { 'pt-BR': ptBR, en };

/** Test-only: the text a `lib/` message reference shows in `locale` (Portuguese by default). */
export const textOf = (
  value: Translatable | null | undefined,
  locale: Locale = 'pt-BR',
): string => {
  const translator = createTranslator({ locale, messages: MESSAGES[locale] });
  return resolveMessage(
    (key, values) => translator(key as never, values as never),
    value ?? '',
  );
};
