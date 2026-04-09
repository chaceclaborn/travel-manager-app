import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Database,
  Ban,
  Server,
  Users,
  Plug,
  UserCheck,
  Baby,
  RefreshCw,
  Mail,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | Travel Manager',
  description:
    'Privacy Policy for Travel Manager — what data we collect, how it is stored, and your rights as a user.',
  openGraph: {
    title: 'Privacy Policy | Travel Manager',
    description:
      'Privacy Policy for Travel Manager — what data we collect, how it is stored, and your rights as a user.',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | Travel Manager',
    description:
      'Privacy Policy for Travel Manager — what data we collect, how it is stored, and your rights as a user.',
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
    icon: Database,
    title: 'What We Collect',
    paragraphs: [
      'When you use Travel Manager, we collect and store the following on your behalf:',
    ],
    items: [
      'Account information: your email address (required for sign-in) and, optionally, your name and profile photo.',
      'Home location: if you enter a home city, we geocode it to latitude and longitude so the map view can center on it. This is never pulled from your device\u2019s GPS \u2014 you type it in manually.',
      'Your business data: the trips, clients, vendors, bookings, meetings, itinerary items, expenses, checklists, and notes that you create in the app. This data is yours. We treat it as confidential and process it only to provide the service you\u2019re paying for (or using free during beta).',
      'Attachments: any files you upload (receipts, booking confirmations, etc.).',
      'Push notification tokens: if you enable notifications, we store an Apple Push Notification Service (APNs) token so we can send you the alerts you requested.',
      'Usage analytics: we log in-app clicks and page visits to understand which features are used and to fix bugs. This is linked to your account but is never sold or shared with advertisers.',
      'Audit log: sign-in, sign-out, data export, and account deletion events are logged with IP address and user agent for security.',
    ],
  },
  {
    icon: Ban,
    title: 'What We Do NOT Collect',
    items: [
      'We do not track you across other apps or websites.',
      'We do not use the iOS advertising identifier (IDFA).',
      'We do not sell or share your data with data brokers or ad networks.',
      'We do not access your device\u2019s contacts, photos, camera, microphone, or location without an explicit in-app request and your permission.',
    ],
  },
  {
    icon: Server,
    title: 'Where Your Data Is Stored',
    items: [
      'Database and authentication: Supabase (PostgreSQL), US region.',
      'Web hosting: Vercel, US region.',
      'Encryption: data is encrypted in transit (TLS) and at rest. OAuth tokens (e.g., Gmail) are additionally encrypted with AES-256-GCM before being stored in our database.',
    ],
  },
  {
    icon: Users,
    title: 'Who Can Access Your Data',
    items: [
      'You. Always. You can view, edit, export, and delete everything from inside the app.',
      'Chace Claborn (developer/operator), only when required to resolve a support request you have opened or to investigate a security incident.',
      'No one else. We do not have a sales team, a marketing data warehouse, or an analytics vendor that touches your business data.',
    ],
  },
  {
    icon: Plug,
    title: 'Third-Party Services',
    paragraphs: [
      'The following services may process limited data on our behalf:',
    ],
    items: [
      'Supabase \u2014 database and authentication provider (processor).',
      'Vercel \u2014 web hosting (processor).',
      'Apple Push Notification Service \u2014 push delivery, if you enable it.',
      'Google Gmail API \u2014 read-only mailbox access, only if you choose to connect Gmail for the booking-import feature. You can disconnect at any time from the in-app settings.',
      'Open-Meteo \u2014 weather forecasts. We send only the latitude and longitude of the trip destination. No user identity is transmitted.',
      'Frankfurter \u2014 currency exchange rates. We send only currency codes.',
    ],
  },
  {
    icon: UserCheck,
    title: 'Your Rights',
    paragraphs: ['You have the right to:'],
    items: [
      'Access and export all your data. Use the in-app export feature (available at /api/user/export) to download a complete JSON archive of your account.',
      'Correct any information by editing it inside the app.',
      'Delete your account and all associated data at any time. Use the in-app delete-account feature (available at /api/user/delete). Deletion is permanent and cannot be undone.',
      'Withdraw consent for optional features (Gmail import, push notifications, home location) from settings at any time.',
      'We comply with GDPR and CCPA to the extent they apply.',
    ],
  },
  {
    icon: Baby,
    title: 'Children',
    paragraphs: [
      'Travel Manager is a professional tool for travel agents and is not directed at children under 13. We do not knowingly collect data from children.',
    ],
  },
  {
    icon: RefreshCw,
    title: 'Changes',
    paragraphs: [
      'If this policy changes materially, we will notify active users by email and via an in-app banner at least 14 days before the change takes effect.',
    ],
  },
  {
    icon: Mail,
    title: 'Contact',
    paragraphs: [
      'Questions? Email chaceclaborn@gmail.com.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-amber-600"
        >
          <span aria-hidden="true">&larr;</span> Travel Manager
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">Effective date: April 6, 2026</p>
        </header>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            Travel Manager (&ldquo;the App&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is
            operated by Chace Claborn as an independent developer. This policy explains what
            data we collect, why we collect it, and what your rights are.
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

        <footer className="mt-10 flex flex-col items-center gap-3 text-center text-sm text-slate-500">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/terms" className="text-amber-600 hover:underline">
              Terms of Service
            </Link>
            <Link href="/support" className="text-amber-600 hover:underline">
              Support
            </Link>
            <Link href="/" className="text-amber-600 hover:underline">
              Back to Travel Manager
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
