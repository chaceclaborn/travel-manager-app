'use client';

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
  Plane,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/travelmanager/useAuth';

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
  { icon: UserCheck, text: 'Google authentication for secure sign-in' },
  { icon: Lock, text: 'Encrypted data storage' },
  { icon: Shield, text: 'Per-user data isolation' },
  { icon: Download, text: 'Export your data anytime' },
  { icon: Trash2, text: 'Delete your account and data on request' },
];

export default function TourPage() {
  const { signInWithGoogle } = useAuth();
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
        <motion.div variants={item} className="text-center pt-8 pb-16">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-amber-100">
            <Plane className="size-8 text-amber-600" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Travel Manager
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-slate-600">
            Plan trips, manage vendors, track clients — all in one place
          </p>
          <Button
            onClick={signInWithGoogle}
            size="lg"
            className="mt-8 bg-amber-500 hover:bg-amber-600 text-white px-8 text-base"
          >
            Sign in with Google
          </Button>
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
                className="rounded-xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-amber-100">
                  <feature.icon className="size-5 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">{feature.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Security Section */}
        <motion.div variants={item} className="mt-16 rounded-xl bg-white p-8 shadow-sm">
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
          </p>
        </motion.div>

        {/* Footer CTA */}
        <motion.div variants={item} className="mt-16 pb-8 text-center">
          <Button
            onClick={signInWithGoogle}
            size="lg"
            className="bg-amber-500 hover:bg-amber-600 text-white px-8 text-base"
          >
            Sign in with Google
          </Button>
          <p className="mt-3 text-sm text-slate-400">Secure sign-in with your Google account</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
