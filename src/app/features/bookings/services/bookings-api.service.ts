import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { BookingRequest, MyBooking } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/bookings';

  getMyBookings(): Observable<MyBooking[]> {
    return this.http.get<MyBooking[]>(`${this.baseUrl}/mine`);
  }

  getBookingRequests(): Observable<BookingRequest[]> {
    return this.http.get<BookingRequest[]>(`${this.baseUrl}/requests`);
  }

  approveBookingRequest(bookingId: string): Observable<void> {
    const url = `${this.baseUrl}/${encodeURIComponent(bookingId)}/approve`;
    return this.http.post<void>(url, {});
  }

  rejectBookingRequest(bookingId: string): Observable<void> {
    const url = `${this.baseUrl}/${encodeURIComponent(bookingId)}/reject`;
    return this.http.post<void>(url, {});
  }
}
