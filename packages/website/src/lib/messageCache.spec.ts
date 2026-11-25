import en from '../messages/en.json';
import {
  messagesFor,
  preloadMessages,
  resetMessageCache,
} from './messageCache';
import { DEFAULT_MESSAGES, loadMessages } from './messages';

vi.mock('./messages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./messages')>();
  return { ...actual, loadMessages: vi.fn(actual.loadMessages) };
});

describe('message cache', () => {
  beforeEach(() => {
    resetMessageCache();
    vi.mocked(loadMessages).mockClear();
  });

  it('has the default locale without loading', () => {
    expect(messagesFor('pt-BR')).toEqual({
      locale: 'pt-BR',
      messages: DEFAULT_MESSAGES,
    });
    expect(loadMessages).not.toHaveBeenCalled();
  });

  it('falls back to the default locale until en is loaded', async () => {
    expect(messagesFor('en').locale).toBe('pt-BR');
    await preloadMessages('en');
    expect(messagesFor('en')).toEqual({ locale: 'en', messages: en });
  });

  it('loads a locale once', async () => {
    await Promise.all([preloadMessages('en'), preloadMessages('en')]);
    await preloadMessages('en');
    expect(loadMessages).toHaveBeenCalledTimes(1);
  });

  it('does not reject on a failed load and retries on the next call', async () => {
    vi.mocked(loadMessages).mockRejectedValueOnce(new Error('chunk failed'));
    await expect(preloadMessages('en')).resolves.toBeUndefined();
    expect(messagesFor('en').locale).toBe('pt-BR');
    await preloadMessages('en');
    expect(messagesFor('en').locale).toBe('en');
  });
});
