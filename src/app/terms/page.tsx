import type { Metadata } from 'next';
import { TMDocHeader, TMDocFooter } from '@/components/travelmanager/TMDocChrome';
import Link from 'next/link';
import {
  Sparkles,
  UserCheck,
  Database,
  ShieldAlert,
  Plug,
  AlertTriangle,
  Scale,
  LogOut,
  Gavel,
  RefreshCw,
  Mail,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | Travel Manager',
  description:
    'Terms of Service for Travel Manager — the all-in-one workspace for independent travel agents.',
  openGraph: {
    title: 'Terms of Service | Travel Manager',
    description:
      'Terms of Service for Travel Manager — the all-in-one workspace for independent travel agents.',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | Travel Manager',
    description:
      'Terms of Service for Travel Manager — the all-in-one workspace for independent travel agents.',
  },
};

type Section = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  paragraphs?: string[];
  items?: string[];
};

const sections: Section[] = [
  {
    icon: Sparkles,
    title: '1. Early Access / Beta',
    paragraphs: [
      'Travel Manager is in early access. Features may change, break, or be removed as we iterate. We aim for stability, but we cannot guarantee it during this period. If a critical bug causes data loss despite our backups, your remedy is a refund of any fees you have paid in the preceding 30 days (currently $0, since the app is free during beta).',
    ],
  },
  {
    icon: UserCheck,
    title: '2. Your Account',
    items: [
      'You must be at least 18 years old and legally able to enter a contract.',
      'You are responsible for keeping your sign-in email secure.',
      'One account per person. Do not share credentials.',
      'You must provide accurate information when signing up.',
    ],
  },
  {
    icon: Database,
    title: '3. Your Data, Your Ownership',
    paragraphs: [
      'Everything you create in Travel Manager — trips, clients, vendors, bookings, notes, attachments — is yours. We claim no ownership over it. You grant us a limited license to store and process it solely to provide the service to you. You can export or delete it at any time.',
    ],
  },
  {
    icon: ShieldAlert,
    title: '4. Acceptable Use',
    paragraphs: ['You agree NOT to:'],
    items: [
      'Use the app for anything illegal or to harm others.',
      'Scrape, crawl, or automate the app beyond what the normal UI allows.',
      'Attempt to reverse engineer, break encryption, or probe security.',
      'Resell, white-label, or sublicense the service without written permission.',
      'Upload malware, illegal content, or data that violates third-party rights.',
      'Impersonate others or misrepresent your affiliation with any organization.',
      'Use the app to send unsolicited marketing ("spam") to your clients.',
    ],
  },
  {
    icon: Plug,
    title: '5. Third-Party Services',
    paragraphs: [
      'Travel Manager integrates with third-party services (weather and mapping APIs, etc.) when you choose to enable them. Your use of those services is also governed by their terms. We are not responsible for outages or changes to third-party services.',
    ],
  },
  {
    icon: AlertTriangle,
    title: '6. No Warranty',
    paragraphs: [
      'THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, BUG-FREE, OR SECURE.',
    ],
  },
  {
    icon: Scale,
    title: '7. Limitation of Liability',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF YOUR USE OF THE APP IS LIMITED TO THE GREATER OF (A) THE AMOUNT YOU HAVE PAID US IN THE PRECEDING 12 MONTHS OR (B) USD $50. WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION.',
    ],
  },
  {
    icon: LogOut,
    title: '8. Termination',
    paragraphs: [
      'You may stop using Travel Manager and delete your account at any time. We may terminate or suspend your account if you violate these terms, if required by law, or if we discontinue the service. Upon termination, your data will be deleted in accordance with the Privacy Policy.',
    ],
  },
  {
    icon: Gavel,
    title: '9. Governing Law',
    paragraphs: [
      'These terms are governed by the laws of the United States, without regard to conflict of laws principles. Any disputes will be resolved in the state or federal courts located in the operator\u2019s home jurisdiction, and you consent to that jurisdiction.',
    ],
  },
  {
    icon: RefreshCw,
    title: '10. Changes',
    paragraphs: [
      'We may update these terms occasionally. If the changes are material, we will notify you in the app or by email at least 14 days before they take effect. Continued use after the effective date means you accept the new terms.',
    ],
  },
  {
    icon: Mail,
    title: '11. Contact',
    paragraphs: [
      'Questions? Email chaceclaborn@gmail.com.',
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-tm-app text-tm-body">
      <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <TMDocHeader title="Terms of Service" subtitle="Effective date: April 6, 2026" />

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            Welcome to Travel Manager. By creating an account or using the app, you agree to
            these terms. Please read them &mdash; they&rsquo;re short. These terms work alongside
            our{' '}
            <Link href="/privacy" className="text-amber-600 hover:underline">
              Privacy Policy
            </Link>
            , which explains how your data is handled.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map(({ icon: Icon, title, paragraphs, items }) => (
            <section key={title} className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
                  <Icon className="size-5 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
              </div>

              {paragraphs?.map((p, i) => (
                <p
                  key={i}
                  className="mb-3 text-sm leading-relaxed text-slate-600 last:mb-0"
                >
                  {p}
                </p>
              ))}

              {items && items.length > 0 && (
                <ul className="mt-3 space-y-2.5">
                  {items.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-sm leading-relaxed text-slate-600"
                    >
                      <span className="mt-1.5 shrink-0 text-amber-400" aria-hidden="true">
                        &bull;
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <TMDocFooter current="terms" />
      </div>
    </main>
  );
}
