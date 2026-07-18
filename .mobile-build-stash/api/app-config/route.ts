import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  MIN_SUPPORTED_APP_VERSION,
  LATEST_APP_VERSION,
  IOS_APP_STORE_URL,
} from '@/lib/app-version';

/**
 * Public app configuration for native clients (version-skew handling).
 * Deliberately unauthenticated: a hard-blocked outdated client may not be
 * able to sign in, but must still learn that it needs to update.
 *
 * The iOS shell sends `X-App-Version: "1.0.1 (5) ios"` on every API call
 * (see native-fetch.ts); it's logged here so old-client traffic is visible
 * in Vercel logs before any contract-phase migration ships.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 'read');
  if (limited) return limited;

  const clientVersion = request.headers.get('x-app-version');
  if (clientVersion) {
    console.log(`app-config: client version ${clientVersion}`);
  }

  return NextResponse.json(
    {
      minVersion: MIN_SUPPORTED_APP_VERSION,
      latestVersion: LATEST_APP_VERSION,
      iosStoreUrl: IOS_APP_STORE_URL,
    },
    {
      // Clients check on launch; a short shared cache keeps this cheap
      // without delaying a version-policy change by more than a few minutes.
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    }
  );
}
