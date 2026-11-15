import { StardewValleyApi } from '../generated/stardew-valley-api/client.gen';
import { apiErrorMessage } from './Notifications';

// Goes through the real generated client; only `fetch` (external) is mocked.
const clientReturning = (status: number, body: unknown) =>
  new StardewValleyApi({
    url: 'https://api.test',
    fetch: vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  });

const VALID = {
  seedId: 'test-seed',
  plantedOn: { year: 1, season: 'summer', day: 1 },
  fertilizer: 'none',
  location: 'farm',
  quantity: 1,
} as const;

describe('API error messages', () => {
  it('should translate the business rule detail when the API rejects a planting with 422', async () => {
    const client = clientReturning(422, {
      detail: [
        {
          loc: ['body', 'seedId'],
          msg: 'Seed cannot be planted in this season',
          type: 'value_error',
        },
      ],
    });
    const error = await client.createPlanting(VALID).catch((e: unknown) => e);
    expect(apiErrorMessage(error)).toBe(
      'A semente não pode ser plantada nesta estação.',
    );
  });

  it('should translate the not found detail when the API answers 404', async () => {
    const client = clientReturning(404, { detail: 'Planting not found' });
    const error = await client
      .deletePlanting({ plantingId: 'missing' })
      .catch((e: unknown) => e);
    expect(apiErrorMessage(error)).toBe('Plantio não encontrado.');
  });

  it('should use the generic message when 422 is a plain field validation error', async () => {
    const client = clientReturning(422, {
      detail: [
        {
          loc: ['body', 'quantity'],
          msg: 'Input should be less than or equal to 99',
          type: 'less_than_equal',
        },
      ],
    });
    const error = await client.createPlanting(VALID).catch((e: unknown) => e);
    expect(apiErrorMessage(error)).toBe(
      'Não foi possível salvar. Tente novamente.',
    );
  });
});
