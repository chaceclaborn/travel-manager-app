import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LogIn,
  MapPinned,
  Share2,
  Wallet,
  Download,
  Trash2,
  Mail as MailIcon,
  Activity,
  HelpCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Support | Travel Manager',
  description:
    'Support and help for Travel Manager — common questions, contact info, and system status.',
  openGraph: {
    title: 'Support | Travel Manager',
    description:
      'Support and help for Travel Manager — common questions, contact info, and system status.',
    type: 'article',
  },
  twitter: {
    card: 'summary',
    title: 'Support | Travel Manager',
    description:
      'Support and help for Travel Manager — common questions, contact info, and system status.',
  },
};

type Faq = {
  icon: React.ComponentType<{ className?: string }>;
  question: string;
  answer: string;
};

const faqs: Faq[] = [
  {
    icon: LogIn,
    question: 'How do I sign in?',
    answer:
      'On the sign-in screen, enter your email and password and tap \u201cSign in\u201d. On the web you can also use \u201cSign in with Google\u201d or \u201cSign in with Apple\u201d.',
  },
  {
    icon: MapPinned,
    question: 'How do I create a trip?',
    answer:
      'From the Dashboard or the Trips tab, tap \u201cNew Trip\u201d. Give it a title and destination, pick dates, and save. From there you can add itinerary items, attach flights and hotels, link clients and vendors, and view weather and a map.',
  },
  {
    icon: Share2,
    question: 'How do I share a trip with a client?',
    answer:
      'Open the trip, tap the share icon, and toggle \u201cShare with client\u201d on. Copy the generated link and send it. Your client sees a clean, read-only itinerary with weather and a map \u2014 no login required. You can revoke the link or set an expiration date any time.',
  },
  {
    icon: Wallet,
    question: 'How do I track commission?',
    answer:
      'On any booking you can record the commission amount, rate, and paid status. The Bookings view shows colored badges for earned/pending/paid, and the Dashboard summarizes totals by month so you always know where you stand.',
  },
  {
    icon: Download,
    question: 'How do I export my data?',
    answer:
      'Go to Settings \u2192 Account \u2192 Export my data. You\u2019ll download a complete JSON archive of everything in your account \u2014 trips, clients, vendors, bookings, notes, and attachments metadata.',
  },
  {
    icon: Trash2,
    question: 'How do I delete my account?',
    answer:
      'Go to Settings \u2192 Account \u2192 Delete my account. Deletion is immediate and permanent \u2014 all trips, clients, vendors, bookings, and sign-in history are removed and cannot be recovered. Export your data first if you want a copy.',
  },
  {
    icon: HelpCircle,
    question: 'What does it cost?',
    answer:
      'Travel Manager is free during the early access period. Pro features (team collaboration, white-label client portals) will be available later via in-app subscription. Existing users will be notified well in advance of any pricing changes.',
  },
];

export default function SupportPage() {
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
            Travel Manager Support
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Need help? You&rsquo;re in the right place.
          </p>
        </header>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-600">
            Most questions are answered below. If you don&rsquo;t see what you&rsquo;re looking
            for, email us directly and we&rsquo;ll get back to you within one business day.
          </p>
        </div>

        <h2 className="mb-4 text-xl font-semibold text-slate-800">Common Questions</h2>

        <div className="space-y-6">
          {faqs.map(({ icon: Icon, question, answer }) => (
            <section key={question} className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
                  <Icon className="size-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">{question}</h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{answer}</p>
            </section>
          ))}
        </div>

        {/* Contact */}
        <section className="mt-10 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
              <MailIcon className="size-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Contact us</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Email:{' '}
            <a
              href="mailto:chaceclaborn@gmail.com"
              className="font-medium text-amber-600 hover:underline"
            >
              chaceclaborn@gmail.com
            </a>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Response time: within 24 hours on business days.
          </p>
        </section>

        {/* Status */}
        <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
              <Activity className="size-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">System status</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            All systems operational. If you&rsquo;re experiencing an outage, email support and
            we&rsquo;ll investigate. A public status page is coming soon.
          </p>
        </section>

        <footer className="mt-10 flex flex-col items-center gap-3 text-center text-sm text-slate-500">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/terms" className="text-amber-600 hover:underline">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-amber-600 hover:underline">
              Privacy Policy
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
