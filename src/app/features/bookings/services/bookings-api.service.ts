import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  BookingRequest,
  BookingStatus,
  CreateBookingRequest,
  CreateBookingResponse,
  MyBooking,
} from '../models/booking.model';

const KNOWN_BOOKING_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'PendingApproval',
  'Pending',
  'Approved',
  'Rejected',
  'Archived',
  'Cancelled',
]);

function coerceBookingStatus(value: unknown): BookingStatus {
  if (typeof value === 'string' && KNOWN_BOOKING_STATUSES.has(value as BookingStatus)) {
    return value as BookingStatus;
  }
  return 'PendingApproval';
}

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toNullableStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeCreateBookingResponse(
  response: Partial<CreateBookingResponse> & { id: string },
): CreateBookingResponse {
  return {
    id: String(response.id),
    listingId: toStr(response.listingId),
    status: coerceBookingStatus(response.status),
    startDate: toStr(response.startDate),
    endDate: toStr(response.endDate),
    totalPrice: toFiniteNumber(response.totalPrice),
    createdAt: toNullableStr(response.createdAt),
  };
}

function normalizeMyBooking(item: Partial<MyBooking> & { id: string }): MyBooking {
  return {
    id: String(item.id),
    listingId: toStr(item.listingId),
    listingTitle: toStr(item.listingTitle),
    startDate: toStr(item.startDate),
    endDate: toStr(item.endDate),
    totalPrice: toFiniteNumber(item.totalPrice),
    status: coerceBookingStatus(item.status),
    createdAt: toNullableStr(item.createdAt),
  };
}

function normalizeBookingRequest(
  item: Partial<BookingRequest> & { id: string },
): BookingRequest {
  return {
    id: String(item.id),
    listingId: toStr(item.listingId),
    listingTitle: toStr(item.listingTitle),
    renterFirstName: toStr(item.renterFirstName),
    renterLastName: toStr(item.renterLastName),
    renterEmail: toStr(item.renterEmail),
    renterPhoneNumber: toNullableStr(item.renterPhoneNumber),
    startDate: toStr(item.startDate),
    endDate: toStr(item.endDate),
    totalPrice: toFiniteNumber(item.totalPrice),
    status: coerceBookingStatus(item.status),
    createdAt: toNullableStr(item.createdAt),
  };
}

@Injectable({ providedIn: 'root' })
export class BookingsApiService {
  private readonly http = inject(HttpClient);

  createBooking(payload: CreateBookingRequest): Observable<CreateBookingResponse> {
    return this.http
      .post<CreateBookingResponse>(toApiUrl(ApiContract.bookings.create), payload)
      .pipe(map((response) => normalizeCreateBookingResponse(response)));
  }

  getMyBookings(): Observable<MyBooking[]> {
    return this.http.get<MyBooking[]>(toApiUrl(ApiContract.bookings.mine)).pipe(
      map((items) =>
        Array.isArray(items)
          ? items
              .filter(
                (item): item is MyBooking =>
                  item !== null &&
                  item !== undefined &&
                  typeof item.id === 'string',
              )
              .map((item) => normalizeMyBooking(item))
          : [],
      ),
    );
  }

  getBookingRequests(): Observable<BookingRequest[]> {
    return this.http
      .get<BookingRequest[]>(toApiUrl(ApiContract.bookings.requests))
      .pipe(
        map((items) =>
          Array.isArray(items)
            ? items
                .filter(
                  (item): item is BookingRequest =>
                    item !== null &&
                    item !== undefined &&
                    typeof item.id === 'string',
                )
                .map((item) => normalizeBookingRequest(item))
            : [],
        ),
      );
  }

  approveBookingRequest(bookingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.bookings.approve(bookingId)), {});
  }

  rejectBookingRequest(bookingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.bookings.reject(bookingId)), {});
  }
}
