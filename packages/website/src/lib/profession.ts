import type { ProfileIn } from '../generated/stardew-valley-api/types.gen';

/** The level-10 Tiller professions; the game lets the player pick only one. */
export type Profession = 'none' | 'agriculturist' | 'artisan';

export const professionOf = (
  profile: Pick<ProfileIn, 'agriculturist' | 'artisan'>,
): Profession =>
  profile.agriculturist
    ? 'agriculturist'
    : profile.artisan
      ? 'artisan'
      : 'none';

export const professionFlags = (
  profession: Profession,
): { agriculturist: boolean; artisan: boolean } => ({
  agriculturist: profession === 'agriculturist',
  artisan: profession === 'artisan',
});
