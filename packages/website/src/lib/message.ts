import type { MessageKey } from './messages';

/**
 * A value of a message argument: plain text or a number, another message reference (resolved
 * first, e.g. a season name inside a date) or a list of references (joined with ", ").
 */
export type MessageValue = string | number | MessageRef | readonly MessageRef[];

export type MessageValues = Readonly<Record<string, MessageValue>>;

/** What `lib/` returns instead of translated text: a message key and its arguments. */
export type MessageRef = { key: MessageKey; values?: MessageValues };

/** Already-localized text (game data) or a reference to translate. */
export type Translatable = string | MessageRef;

export const message = (key: MessageKey, values?: MessageValues): MessageRef =>
  values ? { key, values } : { key };

export type Translate = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

const isRef = (value: MessageValue): value is MessageRef =>
  typeof value === 'object' && !Array.isArray(value);

/** Turns a `Translatable` into text with `translate`, resolving nested references first. */
export const resolveMessage = (
  translate: Translate,
  value: Translatable,
): string => {
  if (typeof value === 'string') return value;
  const values = Object.fromEntries(
    Object.entries(value.values ?? {}).map(([name, argument]) => [
      name,
      typeof argument === 'string' || typeof argument === 'number'
        ? argument
        : isRef(argument)
          ? resolveMessage(translate, argument)
          : (argument as readonly MessageRef[])
              .map((item) => resolveMessage(translate, item))
              .join(', '),
    ]),
  );
  return translate(value.key, values);
};
