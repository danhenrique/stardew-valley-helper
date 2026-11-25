import type { MessageKeys, NestedKeyOf } from 'use-intl';
import ptBR from '../messages/pt-BR.json';
import type { Locale } from './locale';

/** Shape of every message file; `pt-BR.json` is the source of truth. */
export type Messages = typeof ptBR;

/** A full dotted key of a message (e.g. `notFound.title`), for `lib/` code returning keys. */
export type MessageKey = MessageKeys<Messages, NestedKeyOf<Messages>>;

/** Messages of the default locale, bundled eagerly so the default locale never waits. */
export const DEFAULT_MESSAGES: Messages = ptBR;

// Every other locale is a dynamic import, so its file is its own chunk and is only downloaded
// when that locale is used.
const loaders: Record<Locale, () => Promise<Messages>> = {
  'pt-BR': async () => DEFAULT_MESSAGES,
  en: async () => (await import('../messages/en.json')).default,
};

export const loadMessages = (locale: Locale): Promise<Messages> =>
  loaders[locale]();
