import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import type { ButtonSeverity } from 'primeng/types/button';
import { Dialog } from 'primeng/dialog';

export type ConfirmDialogTone = 'neutral' | 'danger' | 'warning';

@Component({
  selector: 'app-ui-confirm-dialog',
  standalone: true,
  imports: [NgClass, ButtonModule, Dialog],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly visible = input<boolean>(false);
  readonly title = input<string>('');
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  readonly tone = input<ConfirmDialogTone>('neutral');
  readonly confirming = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  // Mirrors the visible input; can be written locally to let p-dialog track state.
  protected readonly isOpen = linkedSignal(() => this.visible());

  protected readonly headerIconClass = computed(() => {
    const t = this.tone();
    if (t === 'danger') return 'pi pi-times-circle cd__header-icon--danger';
    if (t === 'warning') return 'pi pi-exclamation-circle cd__header-icon--warning';
    return 'pi pi-info-circle cd__header-icon--neutral';
  });

  protected readonly confirmSeverity = computed((): ButtonSeverity => {
    const t = this.tone();
    if (t === 'danger') return 'danger';
    if (t === 'warning') return 'warn';
    return undefined;
  });

  protected onDialogVisibleChange(v: boolean): void {
    if (!v) {
      this.isOpen.set(false);
      this.cancelled.emit();
    }
  }

  protected onConfirm(): void {
    this.confirmed.emit();
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
