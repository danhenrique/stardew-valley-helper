import { LocaleLink } from './LocaleLink';

// Compile-time checks only (never imported). A non-spec file so the app tsconfig, where the
// router is registered, checks it: typecheck fails if LocaleLink stops route-checking props.
export const localeLinkTypeChecks = [
  <LocaleLink key="ok-1" to="/{-$locale}">
    ok
  </LocaleLink>,
  <LocaleLink key="ok-2" to="/{-$locale}/shops/$id" params={{ id: 'pierre' }}>
    ok
  </LocaleLink>,
  <LocaleLink key="ok-3" to="/{-$locale}" locale="en">
    ok
  </LocaleLink>,
  // @ts-expect-error unsupported locale
  <LocaleLink key="bad-3" to="/{-$locale}" locale="fr">
    bad
  </LocaleLink>,
  // @ts-expect-error unknown route
  <LocaleLink key="bad-1" to="/nao-existe">
    bad
  </LocaleLink>,
  // @ts-expect-error missing required $id param
  <LocaleLink key="bad-2" to="/{-$locale}/shops/$id">
    bad
  </LocaleLink>,
];
