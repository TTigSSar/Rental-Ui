import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

interface FaqItem {
  readonly id: string;
  readonly questionKey: string;
  readonly answerKey: string;
}

interface FaqGroup {
  readonly id: string;
  readonly headingKey: string;
  readonly items: readonly FaqItem[];
}

const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: 'renting',
    headingKey: 'info.faq.groups.renting.heading',
    items: [
      {
        id: 'r1',
        questionKey: 'info.faq.items.r1.question',
        answerKey: 'info.faq.items.r1.answer',
      },
      {
        id: 'r2',
        questionKey: 'info.faq.items.r2.question',
        answerKey: 'info.faq.items.r2.answer',
      },
      {
        id: 'r4',
        questionKey: 'info.faq.items.r4.question',
        answerKey: 'info.faq.items.r4.answer',
      },
    ],
  },
  {
    id: 'listing',
    headingKey: 'info.faq.groups.listing.heading',
    items: [
      {
        id: 'l1',
        questionKey: 'info.faq.items.l1.question',
        answerKey: 'info.faq.items.l1.answer',
      },
      {
        id: 'l2',
        questionKey: 'info.faq.items.l2.question',
        answerKey: 'info.faq.items.l2.answer',
      },
      {
        id: 'l3',
        questionKey: 'info.faq.items.l3.question',
        answerKey: 'info.faq.items.l3.answer',
      },
      {
        id: 'l4',
        questionKey: 'info.faq.items.l4.question',
        answerKey: 'info.faq.items.l4.answer',
      },
    ],
  },
  {
    id: 'safety',
    headingKey: 'info.faq.groups.safety.heading',
    items: [
      {
        id: 's1',
        questionKey: 'info.faq.items.s1.question',
        answerKey: 'info.faq.items.s1.answer',
      },
      {
        id: 's2',
        questionKey: 'info.faq.items.s2.question',
        answerKey: 'info.faq.items.s2.answer',
      },
      {
        id: 's3',
        questionKey: 'info.faq.items.s3.question',
        answerKey: 'info.faq.items.s3.answer',
      },
    ],
  },
  {
    id: 'payments',
    headingKey: 'info.faq.groups.payments.heading',
    items: [
      {
        id: 'p1',
        questionKey: 'info.faq.items.p1.question',
        answerKey: 'info.faq.items.p1.answer',
      },
    ],
  },
  {
    id: 'account',
    headingKey: 'info.faq.groups.account.heading',
    items: [
      {
        id: 'a1',
        questionKey: 'info.faq.items.a1.question',
        answerKey: 'info.faq.items.a1.answer',
      },
      {
        id: 'a2',
        questionKey: 'info.faq.items.a2.question',
        answerKey: 'info.faq.items.a2.answer',
      },
      {
        id: 'a3',
        questionKey: 'info.faq.items.a3.question',
        answerKey: 'info.faq.items.a3.answer',
      },
    ],
  },
];

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './faq-page.component.html',
  styleUrl: './faq-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqPageComponent {
  protected readonly faqGroups = FAQ_GROUPS;
  protected readonly expandedId = signal<string | null>('r1');

  protected toggle(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }
}
