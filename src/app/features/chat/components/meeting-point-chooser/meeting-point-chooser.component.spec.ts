import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { MeetingPointChooserComponent } from './meeting-point-chooser.component';

async function open(hasHomePoint: boolean, choice?: 'home' | 'other') {
  TestBed.configureTestingModule({
    imports: [MeetingPointChooserComponent, TranslateModule.forRoot()],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(MeetingPointChooserComponent);
  fixture.componentRef.setInput('open', true);
  fixture.componentRef.setInput('hasHomePoint', hasHomePoint);
  if (choice) {
    fixture.componentRef.setInput('choice', choice);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

/** The dialog is portalled to <body> (`appendTo="body"`). */
const radios = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="radio"]'));
const primary = () =>
  document.body.querySelector<HTMLButtonElement>('.mpc__btn--primary') as HTMLButtonElement;

describe('MeetingPointChooserComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
  });

  it('preselects "My home point" when the owner has one, and the primary button says so', async () => {
    await open(true);
    const [home, other] = radios();
    expect(home.getAttribute('aria-checked')).toBe('true');
    expect(other.getAttribute('aria-checked')).toBe('false');
    expect(primary().textContent).toContain('chat.meetingPoint.chooser.shareHome');
  });

  it('with no home point: "Another place" is forced, the home card is disabled and links to the profile', async () => {
    await open(false, 'home');
    const [home, other] = radios();
    expect(other.getAttribute('aria-checked')).toBe('true');
    expect(home.getAttribute('aria-checked')).toBe('false');
    expect(home.getAttribute('aria-disabled')).toBe('true');
    expect(home.textContent).toContain('chat.meetingPoint.chooser.noHome');
    const link = document.body.querySelector<HTMLAnchorElement>('.mpc__set-home');
    expect(link?.getAttribute('href')).toBe('/profile');
    expect(primary().textContent).toContain('chat.meetingPoint.chooser.chooseMap');
  });

  it('cannot select the disabled home card by click or key', async () => {
    const fixture = await open(false);
    const [home] = radios();
    home.click();
    home.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();
    expect(radios()[0].getAttribute('aria-checked')).toBe('false');
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
  });

  it('the primary label follows the selection', async () => {
    const fixture = await open(true);
    radios()[1].click();
    fixture.detectChanges();
    expect(primary().textContent).toContain('chat.meetingPoint.chooser.chooseMap');
    radios()[0].click();
    fixture.detectChanges();
    expect(primary().textContent).toContain('chat.meetingPoint.chooser.shareHome');
  });

  it('arrow keys move the selection (roving tabindex) and Space selects', async () => {
    const fixture = await open(true);
    expect(radios().map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1']);

    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(radios().map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0']);

    radios()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(radios()[0].getAttribute('aria-checked')).toBe('true');
  });

  it('emits shareHome for the home choice and chooseOnMap for the other', async () => {
    const fixture = await open(true);
    const events: string[] = [];
    fixture.componentInstance.shareHome.subscribe(() => events.push('home'));
    fixture.componentInstance.chooseOnMap.subscribe(() => events.push('map'));

    primary().click();
    radios()[1].click();
    fixture.detectChanges();
    primary().click();

    expect(events).toEqual(['home', 'map']);
  });

  it('"Not now" emits cancelled', async () => {
    const fixture = await open(true);
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => (cancelled += 1));
    document.body.querySelector<HTMLButtonElement>('.mpc__btn--ghost')?.click();
    expect(cancelled).toBe(1);
  });

  it('Escape and a mask click behave like "Not now" (cancelled)', async () => {
    const fixture = await open(true);
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => (cancelled += 1));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(cancelled).toBe(1);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const mask = document.body.querySelector<HTMLElement>('.p-dialog-mask');
    mask?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(cancelled).toBe(2);
  });
});
