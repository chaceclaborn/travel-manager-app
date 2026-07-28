import { Plane, Building2, Car, Train, Bus, Package, type LucideIcon } from 'lucide-react';

/**
 * The icon *component* for each booking type.
 *
 * `typeConfig.icon` below is a pre-sized element, which is convenient inline
 * but useless where a size has to be chosen at the call site (the 38px card
 * tile vs the 52px detail tile). This map is the component form.
 */
export const BOOKING_TYPE_ICON: Record<BookingType, LucideIcon> = {
  FLIGHT: Plane,
  HOTEL: Building2,
  CAR_RENTAL: Car,
  TRAIN: Train,
  BUS: Bus,
  OTHER: Package,
};

export type BookingType = 'FLIGHT' | 'HOTEL' | 'CAR_RENTAL' | 'TRAIN' | 'BUS' | 'OTHER';

export const BOOKING_TYPES = ['ALL', 'FLIGHT', 'HOTEL', 'CAR_RENTAL', 'TRAIN', 'BUS', 'OTHER'] as const;

export const typeConfig: Record<BookingType, { icon: React.ReactNode; label: string; badgeColor: string; iconBg: string; borderAccent: string }> = {
  FLIGHT: {
    icon: <Plane className="size-5" />,
    label: 'Flight',
    badgeColor: 'bg-blue-100 text-blue-700',
    iconBg: 'bg-blue-100 text-blue-600 ring-blue-200',
    borderAccent: 'hover:border-blue-200',
  },
  HOTEL: {
    icon: <Building2 className="size-5" />,
    label: 'Hotel',
    badgeColor: 'bg-purple-100 text-purple-700',
    iconBg: 'bg-purple-100 text-purple-600 ring-purple-200',
    borderAccent: 'hover:border-purple-200',
  },
  CAR_RENTAL: {
    icon: <Car className="size-5" />,
    label: 'Car Rental',
    badgeColor: 'bg-green-100 text-green-700',
    iconBg: 'bg-green-100 text-green-600 ring-green-200',
    borderAccent: 'hover:border-green-200',
  },
  TRAIN: {
    icon: <Train className="size-5" />,
    label: 'Train',
    badgeColor: 'bg-orange-100 text-orange-700',
    iconBg: 'bg-orange-100 text-orange-600 ring-orange-200',
    borderAccent: 'hover:border-orange-200',
  },
  BUS: {
    icon: <Bus className="size-5" />,
    label: 'Bus',
    badgeColor: 'bg-teal-100 text-teal-700',
    iconBg: 'bg-teal-100 text-teal-600 ring-teal-200',
    borderAccent: 'hover:border-teal-200',
  },
  OTHER: {
    icon: <Package className="size-5" />,
    label: 'Other',
    badgeColor: 'bg-slate-100 text-slate-700',
    iconBg: 'bg-slate-100 text-slate-600 ring-slate-200',
    borderAccent: 'hover:border-slate-300',
  },
};

export const typeLabels = {
  location: { FLIGHT: 'Departure Airport', HOTEL: 'Location', CAR_RENTAL: 'Pickup Location', TRAIN: 'Departure Station', BUS: 'Departure Station', OTHER: 'Location' },
  endLocation: { FLIGHT: 'Arrival Airport', HOTEL: '', CAR_RENTAL: 'Dropoff Location', TRAIN: 'Arrival Station', BUS: 'Arrival Station', OTHER: '' },
  startDateTime: { FLIGHT: 'Departure Time', HOTEL: 'Check-in Date', CAR_RENTAL: 'Pickup Time', TRAIN: 'Departure Time', BUS: 'Departure Time', OTHER: 'Start Date/Time' },
  endDateTime: { FLIGHT: 'Arrival Time', HOTEL: 'Check-out Date', CAR_RENTAL: 'Dropoff Time', TRAIN: 'Arrival Time', BUS: 'Arrival Time', OTHER: 'End Date/Time' },
} as const;

export const emptyBookingForm = {
  type: 'FLIGHT' as BookingType,
  provider: '',
  confirmationNum: '',
  startDateTime: '',
  endDateTime: '',
  location: '',
  endLocation: '',
  seat: '',
  notes: '',
};

export function getBookingFormHelpers(type: BookingType) {
  return {
    showEndLocation: type !== 'HOTEL',
    showSeat: type === 'FLIGHT' || type === 'TRAIN' || type === 'BUS',
    dateOnly: type === 'HOTEL',
  };
}
