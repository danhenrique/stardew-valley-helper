import { useTranslations } from 'use-intl';
import { useMe, useUpdateProfile } from '../hooks/useGameData';
import { GameDayNav } from './GameDayNav';
import { apiErrorMessage, useNotifications } from './Notifications';
import { Skeleton, SkeletonBar } from './Skeleton';

/** Header game day control wired to the player's profile. */
export const GameDayNavContainer = () => {
  const t = useTranslations('nav.day');
  const me = useMe();
  const updateProfile = useUpdateProfile();
  const { notifyError } = useNotifications();

  if (me.isPending) {
    return (
      <Skeleton label={t('loading')}>
        <SkeletonBar className="h-9 w-56 rounded-md" />
      </Skeleton>
    );
  }
  const profile = me.data?.profile;
  if (!profile) return null;

  return (
    <GameDayNav
      profile={profile}
      onSave={(next) =>
        updateProfile.mutate(next, {
          onError: (error) => notifyError(apiErrorMessage(error)),
        })
      }
    />
  );
};
