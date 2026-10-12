import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { switchMap } from 'rxjs';

import {
  asItem,
  parseInline,
  type LegalInlinePart,
  type LegalSection,
} from './legal-document.model';

/**
 * Renders the intro paragraphs and numbered sections of a legal page from the translation
 * tree `<translationKey>.intro` (string[]) and `<translationKey>.sections` (LegalSection[]).
 */
@Component({
  selector: 'app-legal-document',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './legal-document.component.html',
  styleUrl: './legal-document.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalDocumentComponent {
  private readonly translate = inject(TranslateService);

  readonly translationKey = input.required<string>();
  /** Zero-based index of a section drawn as a highlighted panel (e.g. the payments disclaimer). */
  readonly highlightSection = input<number | null>(null);

  private readonly key$ = toObservable(this.translationKey);

  private readonly introRaw = toSignal(
    this.key$.pipe(switchMap((key) => this.translate.stream(`${key}.intro`))),
    { initialValue: [] as unknown },
  );
  private readonly sectionsRaw = toSignal(
    this.key$.pipe(switchMap((key) => this.translate.stream(`${key}.sections`))),
    { initialValue: [] as unknown },
  );

  protected readonly intro = computed<readonly string[]>(() => {
    const value = this.introRaw();
    return Array.isArray(value) ? (value as string[]) : [];
  });

  protected readonly sections = computed<readonly LegalSection[]>(() => {
    const value = this.sectionsRaw();
    return Array.isArray(value) ? (value as LegalSection[]) : [];
  });

  protected readonly inline = (value: string): LegalInlinePart[] => parseInline(value);
  protected readonly item = asItem;

  protected sectionId(index: number): string {
    return `${this.translationKey().replace(/\./g, '-')}-s${index + 1}`;
  }
}
