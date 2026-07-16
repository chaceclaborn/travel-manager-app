'use client';

import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MapPin,
  Building2,
  Users,
  Paperclip,
  Calendar,
  Search,
  Shield,
  Lock,
  UserCheck,
  Download,
  Trash2,
  AlertCircle,
  Mail,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/travelmanager/useAuth';
import { isNativePlatform } from '@/lib/mobile-auth';

const errorMessages: Record<string, string> = {
  session_expired: 'Your session expired. Please sign in again.',
  email_conflict: 'There was a conflict with your account. Please try again or contact support.',
  auth: 'There was a problem signing in. Please try again.',
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, ease: 'easeOut' as const },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const features = [
  {
    title: 'Trip Planning',
    description: 'Organize trips with itineraries, dates, and budgets',
    icon: MapPin,
  },
  {
    title: 'Vendor Management',
    description: 'Track hotels, transport, restaurants, and suppliers',
    icon: Building2,
  },
  {
    title: 'Client Tracking',
    description: 'Manage client relationships and trip associations',
    icon: Users,
  },
  {
    title: 'File Attachments',
    description: 'Store flight logs, hotel reservations, car rental docs',
    icon: Paperclip,
  },
  {
    title: 'Calendar View',
    description: 'Visual calendar with all your upcoming trips',
    icon: Calendar,
  },
  {
    title: 'Global Search',
    description: 'Find anything instantly with Cmd+K search',
    icon: Search,
  },
];

const securityPoints = [
  { icon: UserCheck, text: 'Google or Apple authentication for secure sign-in' },
  { icon: Lock, text: 'Encrypted data storage' },
  { icon: Shield, text: 'Per-user data isolation' },
  { icon: Download, text: 'Export your data anytime' },
  { icon: Trash2, text: 'Delete your account and data on request' },
];

// Apple HIG-compliant logo for "Sign in with Apple" button.
// See: https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export default function TourPage() {
  return (
    <Suspense>
      <TourPageContent />
    </Suspense>
  );
}

/**
 * Email + password sign-in. Kept understated (revealed behind a link) because
 * the product's primary sign-in is OAuth. Two reasons it exists:
 *  1. It's the reliable auth path inside the native iOS shell, where the OAuth
 *     redirect to /auth/callback isn't part of the bundled static export.
 *  2. It's the demo path we hand to App Review so the reviewer never has to
 *     clear a third-party OAuth (Google) challenge.
 */
function EmailSignIn() {
  const { signInWithEmail } = useAuth();
  const [open, setOpen] = useState(false);
  // In the native shell OAuth is hidden, so email is the only sign-in path —
  // reveal the form by default there.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration platform detection, not a render cascade
  useEffect(() => { if (isNativePlatform()) setOpen(true); }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const err = await signInWithEmail(email.trim(), password);
    if (err) {
      setError(err);
      setSubmitting(false); // on success we navigate away, so only reset on error
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline active:text-slate-600"
      >
        Sign in with email
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex w-64 flex-col gap-2">
      <Input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        aria-label="Email"
      />
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        aria-label="Password"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={submitting}
        className="w-full gap-2 bg-slate-800 text-white hover:bg-slate-900 active:bg-slate-900"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

function TourPageContent() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  // In the native iOS shell the OAuth redirect target (/auth/callback) isn't part
  // of the bundled static export, so Google/Apple sign-in can't complete — hide
  // those buttons and use email/password (which works natively). Detected after
  // mount so the first render still matches the prerendered (web) HTML.
  const [native, setNative] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration platform detection, not a render cascade
  useEffect(() => { setNative(isNativePlatform()); }, []);
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode ? errorMessages[errorCode] ?? errorMessages.auth : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/60 via-white to-slate-50">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8"
      >
        {errorMessage && (
          <motion.div
            variants={item}
            className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          >
            <AlertCircle className="size-5 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </motion.div>
        )}

        {/* Hero Section */}
        <motion.div variants={item} className="relative text-center pt-8 pb-16">
          {/* Decorative backdrop — faint blueprint grid + soft amber glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-16 bottom-0 bg-grid-faint [mask-image:radial-gradient(ellipse_65%_65%_at_50%_35%,black,transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-4 size-72 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl"
          />
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={96}
            height={96}
            priority
            className="relative mx-auto mb-6 size-24 drop-shadow-[0_8px_24px_rgba(245,158,11,0.35)]"
            aria-hidden="true"
          />
          <h1 className="relative text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-gradient-brand">Travel Manager</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
            Plan trips, manage vendors, track clients — all in one place
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            {!native && (
              <>
                <Button
                  onClick={signInWithGoogle}
                  size="lg"
                  className="bg-amber-500 hover:bg-amber-600 text-white px-8 text-base w-64"
                >
                  Sign in with Google
                </Button>
                <Button
                  onClick={signInWithApple}
                  size="lg"
                  className="bg-black hover:bg-neutral-800 text-white px-8 text-base w-64 gap-2"
                >
                  <AppleLogo className="size-5" />
                  Sign in with Apple
                </Button>
              </>
            )}
            <EmailSignIn />
          </div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div variants={item}>
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-amber-600 mb-8">
            Everything you need
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={item}
                className="rounded-xl bg-white p-6 shadow-card ring-1 ring-slate-900/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 ring-1 ring-inset ring-amber-500/10">
                  <feature.icon className="size-5 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">{feature.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Security Section */}
        <motion.div variants={item} className="mt-16 rounded-xl bg-white p-8 shadow-card ring-1 ring-slate-900/[0.03]">
          <div className="text-center mb-6">
            <Shield className="mx-auto size-8 text-amber-600 mb-3" />
            <h2 className="text-xl font-bold text-slate-800">Your data is secure</h2>
          </div>
          <div className="mx-auto max-w-md space-y-3">
            {securityPoints.map((point) => (
              <div key={point.text} className="flex items-center gap-3">
                <point.icon className="size-4 shrink-0 text-amber-500" />
                <span className="text-sm text-slate-600">{point.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Read our{' '}
            <Link href="/privacy" className="text-amber-600 hover:underline">
              Privacy Policy
            </Link>
            {', '}
            <Link href="/terms" className="text-amber-600 hover:underline">
              Terms of Service
            </Link>
            {', or visit '}
            <Link href="/support" className="text-amber-600 hover:underline">
              Support
            </Link>
          </p>
        </motion.div>

        {/* Footer CTA — hidden in the native shell (OAuth redirect isn't in the static export; email is the native path) */}
        {!native && (
          <motion.div variants={item} className="mt-16 pb-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={signInWithGoogle}
                size="lg"
                className="bg-amber-500 hover:bg-amber-600 text-white px-8 text-base w-64"
              >
                Sign in with Google
              </Button>
              <Button
                onClick={signInWithApple}
                size="lg"
                className="bg-black hover:bg-neutral-800 text-white px-8 text-base w-64 gap-2"
              >
                <AppleLogo className="size-5" />
                Sign in with Apple
              </Button>
            </div>
            <p className="mt-3 text-sm text-slate-400">Secure sign-in with your Google or Apple account</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
