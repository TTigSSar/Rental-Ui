import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Card-shaped loading placeholder for the Home toy rows (the design's
 * `ToyCardSkel`): same box, image ratio and text slots as
 * `HomeToyCardComponent`, so the row does not jump when data arrives. It is
 * purely presentational and hidden from assistive tech — the row announces
 * its busy state (`aria-busy`) instead.
 */
@Component({
  selector: 'app-home-toy-card-skeleton',
  standalone: true,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="sk">
      <div class="sk__media bar"></div>
      <div class="sk__body">
        <div class="sk__title">
          <span class="bar" style="width: 92%; height: 12px"></span>
          <span class="bar" style="width: 60%; height: 12px"></span>
        </div>
        <div class="sk__line"><span class="bar" style="width: 62%; height: 10px"></span></div>
        <div class="sk__line"><span class="bar" style="width: 38%; height: 10px"></span></div>
        <div class="sk__price"><span class="bar" style="width: 54%; height: 14px"></span></div>
        <div class="sk__foot">
          <span class="bar sk__chip"></span>
          <span class="bar sk__view"></span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './home-toy-card-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeToyCardSkeletonComponent {}
