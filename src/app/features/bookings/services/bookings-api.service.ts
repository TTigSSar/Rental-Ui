import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { BookingRequest, MyBooking } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingsApiService {
  private readonly http = inject(HttpClient);

  getMyBookings(): Observable<MyBooking[]> {
    return this.http.get<MyBooking[]>(toApiUrl(ApiContract.bookings.mine));
  }

  getBookingRequests(): Observable<BookingRequest[]> {
    return this.http.get<BookingRequest[]>(toApiUrl(ApiContract.bookings.requests));
  }

  approveBookingRequest(bookingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.bookings.approve(bookingId)), {});
  }

  rejectBookingRequest(bookingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.bookings.reject(bookingId)), {});
  }
}
