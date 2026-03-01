import type {
  Trip,
  Vendor,
  Client,
  TripVendor,
  TripClient,
  ItineraryItem,
  TripStatus,
  VendorCategory,
  TripAttachment,
  AuditLog,
  User,
  AttachmentCategory,
  ExpenseCategory,
  BookingType,
  Expense,
  Booking,
  ChecklistItem,
  TripNote,
  TransportMode,
} from '@/lib/generated/prisma';

export type { Trip, Vendor, Client, TripVendor, TripClient, ItineraryItem, TripStatus, VendorCategory, TripAttachment, AuditLog, User, AttachmentCategory, ExpenseCategory, BookingType, Expense, Booking, ChecklistItem, TripNote, TransportMode };

export type TripWithRelations = Trip & {
  vendors: (TripVendor & { vendor: Vendor })[];
  clients: (TripClient & { client: Client })[];
  itinerary: ItineraryItem[];
  expenses?: Expense[];
  bookings?: Booking[];
  checklists?: ChecklistItem[];
  tripNotes?: TripNote[];
};

export type VendorWithTrips = Vendor & {
  trips: (TripVendor & { trip: Trip })[];
};

export type ClientWithTrips = Client & {
  trips: (TripClient & { trip: Trip })[];
};

export interface CreateTripInput {
  title: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: TripStatus;
  notes?: string;
  budget?: number;
  transportMode?: TransportMode | null;
  departureAirportCode?: string | null;
  departureAirportName?: string | null;
  departureAirportLat?: number | null;
  departureAirportLng?: number | null;
  arrivalAirportCode?: string | null;
  arrivalAirportName?: string | null;
  arrivalAirportLat?: number | null;
  arrivalAirportLng?: number | null;
}

export interface UpdateTripInput extends Partial<CreateTripInput> {}

export interface CreateVendorInput {
  name: string;
  category?: VendorCategory;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  website?: string;
  notes?: string;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {}

export interface CreateClientInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}

export interface CreateItineraryItemInput {
  tripId: string;
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  sortOrder?: number;
  vendorId?: string;
  clientId?: string;
}

export interface UpdateItineraryItemInput extends Partial<Omit<CreateItineraryItemInput, 'tripId'>> {}

export interface CreateTripAttachmentInput {
  tripId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  category?: AttachmentCategory;
}

export interface CreateExpenseInput {
  tripId: string;
  amount: number;
  currency?: string;
  category?: ExpenseCategory;
  description?: string;
  date: string;
  receiptPath?: string;
}

export interface UpdateExpenseInput extends Partial<Omit<CreateExpenseInput, 'tripId'>> {}

export interface CreateBookingInput {
  tripId?: string;
  type: BookingType;
  provider: string;
  confirmationNum?: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  endLocation?: string;
  seat?: string;
  notes?: string;
}

export interface UpdateBookingInput extends Partial<Omit<CreateBookingInput, 'tripId'>> {
  tripId?: string | null;
}

export interface CreateChecklistItemInput {
  tripId: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateChecklistItemInput {
  label?: string;
  checked?: boolean;
  sortOrder?: number;
}

export interface CreateTripNoteInput {
  tripId: string;
  date: string;
  content: string;
}

export interface UpdateTripNoteInput {
  date?: string;
  content?: string;
}

