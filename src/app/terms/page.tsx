'use client';

import Link from 'next/link';
import { TMBreadcrumb } from '@/components/travelmanager/TMBreadcrumb';
import { Info, UserCheck, ShieldAlert, Server, Scale, Database, RefreshCw, LogOut, Mail } from 'lucide-react';

const sections = [
  {
    icon: Info,
    title: 'Service Description',
    content: [
      'Travel Manager is a personal trip planning tool designed to help you organize trips, bookings, vendors, and clients in one place',
      'The service provides features for itinerary management, vendor tracking, client management, file storage, and calendar views',
      'Travel Manager is intended for personal and professional travel planning use',
    ],
  },
  {
    icon: UserCheck,
    title: 'Account Terms',
    content: [
      'A Google account is required to sign in and use Travel Manager',
      'Each person may maintain only one account — duplicate or shared accounts are not permitted',
      'You are responsible for maintaining the security of your Google account and any activity that occurs under it',
      'You must be at least 13 years of age to use this service',
    ],
  },
  {
    icon: ShieldAlert,
    title: 'Acceptable Use',
    content: [
      'Do not abuse, disrupt, or overload the service or its infrastructure',
      'Do not attempt to gain unauthorized access to other users\' data or any part of the system',
      'Do not upload, store, or transmit any illegal, harmful, or infringing content',
      'Do not reverse-engineer, decompile, or attempt to extract the source code of the service',
      'Do not use automated tools (bots, scrapers) to access the service without prior written permission',
    ],
  },
  {
    icon: Server,
    title: 'Service Availability',
    content: [
      'Travel Manager is provided on an "as-is" and "as-available" basis with no uptime guarantees',
      'The service may experience downtime for maintenance, updates, or unforeseen technical issues',
      'We reserve the right to modify, suspend, or discontinue the service at any time with reasonable notice when possible',
      'We are not obligated to provide support, but will make reasonable efforts to keep the service running smoothly',
    ],
  },
  {
    icon: Scale,
    title: 'Limitation of Liability',
    content: [
      'Travel Manager and its operators are not liable for any data loss, service interruptions, or damages arising from the use of the service',
      'We are not responsible for travel outcomes, decisions, or consequences based on data stored in or retrieved from the application',
      'The service is not a substitute for professional travel advisory or booking confirmation — always verify important details independently',
      'In no event shall liability exceed the amount you have paid to use the service (which is zero for free accounts)',
    ],
  },
  {
    icon: Database,
    title: 'Data Ownership',
    content: [
      'You retain full ownership of all data you create and store in Travel Manager',
      'You can export all of your data or delete your account at any time from the Settings page — see our Privacy Policy for details',
      'By using the service, you grant us a limited license to store, process, and display your data solely as needed to operate and improve the service',
      'We will never sell your data or use it for purposes outside of providing the service',
    ],
  },
  {
    icon: RefreshCw,
    title: 'Changes to Terms',
    content: [
      'We may update these Terms of Service from time to time to reflect changes in the service or legal requirements',
      'The "Last updated" date at the top of this page will be revised when changes are made',
      'Continued use of Travel Manager after changes are posted constitutes your acceptance of the revised terms',
    ],
  },
  {
    icon: LogOut,
    title: 'Termination',
    content: [
      'We reserve the right to suspend or terminate accounts that violate these terms, with notice when feasible',
      'You may delete your account at any time from the Settings page — all associated data will be permanently removed',
      'Upon termination, your right to access the service ceases immediately, but sections of these terms that should survive (such as Limitation of Liability and Data Ownership) will remain in effect',
    ],
  },
  {
    icon: Mail,
    title: 'Contact',
    content: [
      'For questions or concerns about these Terms of Service, please reach out through the contact form on the main website at chaceclaborn.com',
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <TMBreadcrumb
          items={[
            { label: 'Travel Manager', href: '/' },
            { label: 'Terms of Service' },
          ]}
        />

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Terms of Service</h1>
          <p className="text-sm text-slate-500 mt-1">Last updated: February 2026</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm mb-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            By using Travel Manager, you agree to these terms. Please read them carefully. If you do
            not agree, you should not use the service. These terms work alongside our{' '}
            <Link href="/privacy" className="text-amber-600 hover:underline">
              Privacy Policy
            </Link>
            , which explains how your data is handled.
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
