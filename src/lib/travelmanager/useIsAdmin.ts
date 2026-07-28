'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/travelmanager/useAuth';

/**
 * Whether the signed-in user is the app admin.
 *
 * The answer comes from the server (`/api/auth/is-admin`), which compares the
 * authenticated user's email against ADMIN_EMAIL. That comparison is never done
 * on the client and the value is never trusted from the client — this hook only
 * decides whether to *show* the entry point. `/admin` itself and every admin API
 * route call requireAdmin() independently, so a non-admin who guesses the URL
 * gets a 403 regardless of what this returns.
 *
 * Lives here rather than inline in the (app) layout because the layout is not
 * the only place that needs it: the desktop sidebar and the mobile More screen
 * are two separate navigations, and admin has to appear in both or it is
 * unreachable on a phone — which is exactly what happened.
 */
export function useIsAdmin(): { isAdmin: boolean; checked: boolean } {
  const { user } = useAuth();
  const [result, setResult] = useState({ isAdmin: false, checked: false });

  useEffect(() => {
    // Signed out → nothing to ask the server. Deliberately no setState here:
    // the signed-out answer is derived below instead, because setting state
    // synchronously inside an effect triggers a cascading render (and the
    // React Compiler lint rejects it).
    if (!user) return;
    let cancelled = false;
    fetch('/api/auth/is-admin')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResult({ isAdmin: data.isAdmin === true, checked: true });
      })
      .catch(() => {
        if (!cancelled) setResult({ isAdmin: false, checked: true });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Sign-out must revoke the entry point immediately rather than waiting for a
  // fetch that will never run, so derive it instead of storing it.
  return user ? result : { isAdmin: false, checked: false };
}
