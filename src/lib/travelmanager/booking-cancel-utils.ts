export type BookingStatus = 'ACTIVE' | 'CANCELLED';

export function getNextCancelStatus(status: BookingStatus): BookingStatus {
  return status === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
}

export function getCancelToastMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Booking cancelled' : 'Booking reactivated';
}

export function getCancelErrorMessage(nextStatus: BookingStatus): string {
  return nextStatus === 'CANCELLED' ? 'Failed to cancel booking' : 'Failed to reactivate booking';
}
