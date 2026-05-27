import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-form-field',
  standalone: true,
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  /**
   * Must match the `id` attribute of the projected input element.
   * Used to wire <label for>, aria hint id, and aria error id.
   */
  readonly inputId = input.required<string>();
  readonly required = input<boolean>(false);
  /** Already-translated hint text. Hidden when showError is true. */
  readonly hint = input<string>('');
  /** Already-translated error text. Displayed when showError is true and non-empty. */
  readonly errorMessage = input<string>('');
  readonly showError = input<boolean>(false);
}
