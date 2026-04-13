import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, map } from 'rxjs';

import * as ProfileActions from '../../store/profile.actions';
import {
  selectProfile,
  selectProfileError,
  selectProfileLoading,
} from '../../store/profile.selectors';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    AsyncPipe,
    CardModule,
    MessageModule,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly vm$ = combineLatest({
    profile: this.store.select(selectProfile),
    isLoading: this.store.select(selectProfileLoading),
    error: this.store.select(selectProfileError),
  }).pipe(
    map(({ profile, isLoading, error }) => ({
      profile,
      isLoading,
      error,
      showLoading: isLoading && profile === null,
      showEmpty: !isLoading && profile === null && error === null,
    })),
  );

  ngOnInit(): void {
    this.store.dispatch(ProfileActions.loadProfile());
  }
}
