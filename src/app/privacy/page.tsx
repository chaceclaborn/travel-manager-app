'use client';

import Link from 'next/link';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { Shield, Database, Lock, Clock, UserCheck, Users, Mail, Cookie, Globe } from 'lucide-react';

const sections = [
  {
    icon: Database,
    title: 'Data We Collect',
    content: [
      'Google account information (name, email address, profile photo) provided during sign-in',
      'Trip data you create (destinations, dates, budgets, itineraries, notes)',
      'Vendor records (names, contact info, categories, ratings)',
      'Client records (names, contact info, associated trips)',
      'Booking confirmations and travel arrangement details you save',
      'Sign-in logs including timestamp, IP address, and user agent for security purposes',
    ],
  },
  {
    icon: Lock,
    title: 'How We Store Your Data',
    content: [
      'All data is stored in a PostgreSQL database hosted on Supabase (powered by AWS infrastructure)',
      'Data is encrypted at rest using AES-256 encryption and in transit using TLS 1.2+',
      'Database backups are performed automatically by Supabase on a regular schedule',
    ],
  },
  {
    icon: Shield,
    title: 'Data Isolation',
    content: [
      'Each user can only access their own data — you cannot view, edit, or delete another user\'s trips, vendors, or clients',
      'Data isolation is enforced through application-level access controls — all API routes are authenticated and filter queries by your user ID',
    ],
  },
  {
    icon: Clock,
    title: 'Data Retention',
    content: [
      'Your data is retained for as long as your account exists',
      'When you delete your account, all associated data is permanently removed immediately — this includes trips, vendors, clients, and sign-in history',
      'There is no recovery period after account deletion; the action is irreversible',
    ],
  },
  {
    icon: UserCheck,
    title: 'Your Rights',
    content: [
      'View all data associated with your account through the application interface',
      'Export all of your data as a JSON file at any time from the Settings page',
      'Download PDF summaries of your trip activity for specific time periods',
      'Delete your account and all associated data permanently at any time from the Settings page',
      'You maintain full control over your data at all times',
    ],
  },
  {
    icon: Users,
    title: 'Third-Party Sharing',
    content: [
      'We do not sell your data to any third parties',
      'We do not share your data with any third parties for marketing or advertising purposes',
      'Google — used solely for OAuth authentication (sign-in); no trip data is shared with Google',
      'Supabase — database hosting provider (powered by AWS infrastructure); stores your encrypted data',
      'Vercel — web hosting and deployment platform; serves the application but does not store your personal data',
      'OpenStreetMap / CARTO — provides map tile rendering for trip maps; no personal data is sent to these services',
      'No analytics or tracking services have access to your personal data within Travel Manager',
    ],
  },
  {
    icon: Cookie,
    title: 'Cookies',
    content: [
      'Supabase authentication cookies are used for session management — these are httpOnly and secure cookies required to keep you signed in',
      'No tracking cookies or analytics cookies are used',
      'No third-party advertising cookies are used',
      'The only cookies stored are strictly necessary for authentication and session functionality',
    ],
  },
  {
    icon: Globe,
    title: 'GDPR & CCPA',
    content: [
      'Right to access — you can view all data associated with your account and export it from the Settings page',
      'Right to deletion — you can permanently delete your account and all associated data from the Settings page',
      'Right to portability — you can export all of your data as a JSON file at any time',
      'No profiling or automated decision-making is performed on your data',
      'Data is processed and stored in the United States',
    ],
  },
  {
    icon: Mail,
    title: 'Contact',
    content: [
      'For privacy-related questions or concerns, email us at privacy@travels-manager.com or use the contact form at chaceclaborn.com',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <TMBreadcrumb
          items={[
            { label: 'Travel Manager', href: '/' },
            { label: 'Privacy Policy' },
          ]}
        />

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-1">Last updated: February 2026</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm mb-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            Travel Manager is a personal trip planning tool. This policy explains what data we collect,
            how it is stored, and what control you have over it. We believe in transparency and giving
            you complete ownership of your information.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map(({ icon: Icon, title, content }) => (
            <div key={title} className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center size-9 rounded-lg bg-amber-50">
                  <Icon className="size-5 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
              </div>
              <ul className="space-y-2.5">
                {content.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
                    <span className="text-amber-400 mt-1.5 shrink-0">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/tour"
            className="text-sm text-amber-600 hover:text-amber-700 transition-colors"
          >
            &larr; Back to Tour
          </Link>
        </div>
      </div>
    </div>
  );
}
