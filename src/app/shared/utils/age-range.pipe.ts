import { Pipe, inject, type PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { formatAgeRange } from './age-range.utils';
import { UiDateService } from './ui-date';

/**
 * `{{ from | ageRange: to }}` (months in, ADR-068 display out). Impure so a language switch or a
 * late-loading translation file re-renders it without a reload; the formatting is cheap.
 */
@Pipe({ name: 'ageRange', standalone: true, pure: false })
export class AgeRangePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);
  private readonly dates = inject(UiDateService);

  transform(from: number | null | undefined, to: number | null | undefined): string {
    const lang = this.dates.lang() || this.translate.getCurrentLang() || 'en';
    return formatAgeRange(from, to, lang, (key, params) => this.translate.instant(key, params));
  }
}
