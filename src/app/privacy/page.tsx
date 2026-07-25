import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Database,
  Ban,
  Server,
  Users,
  UserPlus,
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
      'Username: a unique @handle, auto-generated from your email and editable at any time. It lets other users find and add you as a friend. See “Friends & Connections” below for how it is shared and how to stay out of search.',
      'Home location: if you enter a home city, we geocode it to latitude and longitude so the map view can center on it. This is never pulled from your device’s GPS — you type it in manually.',
      'Your business data: the trips, clients, vendors, bookings, meetings, itinerary items, expenses, checklists, and notes that you create in the app. This data is yours. We treat it as confidential and process it only to provide the service you’re paying for (or using free during beta).',
      'Attachments: any files you upload (receipts, booking confirmations, etc.).',
      'Push notification tokens: if you enable notifications, we store an Apple Push Notification Service (APNs) token so we can send you the alerts you requested.',
      'Usage analytics: we log in-app clicks and page visits to understand which features are used and to fix bugs. This is first-party only, linked to your account, and never sold or shared with advertisers. You can turn it off at any time from Settings → Privacy.',
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
      'We do not read your email. Travel Manager does not connect to Gmail or any other mailbox.',
      'We do not send your business data or any other personal data to a third-party AI service.',
      'We do not access your device’s contacts, photos, camera, microphone, or location without an explicit in-app request and your permission.',
    ],
  },
  {
    icon: Server,
    title: 'Where Your Data Is Stored',
    items: [
      'Database and authentication: Supabase (PostgreSQL), US region.',
      'Web hosting: Vercel, US region.',
      'Encryption: data is encrypted in transit (TLS) and at rest.',
    ],
  },
  {
    icon: Users,
    title: 'Who Can Access Your Data',
    items: [
      'You. Always. You can view, edit, export, and delete everything from inside the app.',
      'Chace Claborn (developer/operator), only when required to resolve a support request you have opened or to investigate a security incident.',
      'Other Travel Manager users, but only the limited public profile (username, name, and profile photo) described in “Friends & Connections” below — never your trips, clients, bookings, or any other business data.',
      'Beyond the infrastructure and utility processors listed under “Third-Party Services” below, no one else. We do not sell your data, and we have no marketing data warehouse or advertising/analytics vendor that touches your business data.',
    ],
  },
  {
    icon: UserPlus,
    title: 'Friends & Connections',
    paragraphs: [
      'Travel Manager lets you connect with other users as friends. To make this work, a limited public profile is visible to other users:',
    ],
    items: [
      'Your public profile is only your username (@handle), your name, and your profile photo. Your trips, clients, vendors, bookings, expenses, notes, home location, and email address are never exposed to other users.',
      'Discoverability is on by default: your @handle can appear in other users’ friend-search results so they can add you. You can turn this off at any time from Settings — when off, you no longer appear in search, though someone who already knows your exact @handle can still send you a request.',
      'Adding a friend requires both sides: a request must be sent and then accepted before you are connected. Either person can remove the connection at any time.',
      'We do not import your phone or email contacts, and we do not suggest friends based on any address book.',
    ],
  },
  {
    icon: Plug,
    title: 'Third-Party Services',
    paragraphs: [
      'The following services may process limited data on our behalf:',
    ],
    items: [
      'Supabase — database and authentication provider (processor).',
      'Vercel — web hosting (processor).',
      'Apple Push Notification Service — push delivery, if you enable it.',
      'Open-Meteo — weather forecasts. We send only the latitude and longitude of the trip destination. No user identity is transmitted.',
      'OpenStreetMap Nominatim — place search / geocoding. We send the place text you type when searching for a destination or address.',
      'OSRM (Open Source Routing Machine) — driving distances and routes. We send only trip waypoint coordinates.',
      'AeroDataBox (via RapidAPI) — flight lookups, if you use flight search. We send the flight number and date you enter.',
      'GitHub and Resend — used only to deliver the in-app feedback/support messages you choose to send. They receive the message text and your account identifier so we can follow up.',
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
      'Withdraw consent for optional features (push notifications, home location), hide yourself from friend search, and turn off usage analytics from settings at any time.',
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
          <span aria-hidden="true">&larr;</span>
          <Image src="/brand/logo.png" alt="" width={20} height={20} className="size-5" aria-hidden="true" />
          Travel Manager
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">Effective date: July 5, 2026</p>
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
