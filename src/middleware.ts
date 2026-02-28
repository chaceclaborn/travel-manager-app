import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const OLD_PROJECT_REF = 'biaxoishtoysdjfiqddl';

export async function middleware(request: NextRequest) {
  // CSRF protection: verify Origin header on state-changing API requests
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const staleCookies = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith(`sb-${OLD_PROJECT_REF}-`));

  if (staleCookies.length > 0) {
    staleCookies.forEach((c) => request.cookies.delete(c.name));
    supabaseResponse = NextResponse.next({ request });
    staleCookies.forEach((c) =>
      supabaseResponse.cookies.set(c.name, '', { maxAge: 0, path: '/' })
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
