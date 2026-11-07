import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DeletedUserAvatarComponent, DeletedUserNameComponent } from './index';

describe('deleted-user shared components', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), DeletedUserAvatarComponent, DeletedUserNameComponent],
    });
  });

  it('avatar is decorative, sized and scales the glyph', () => {
    const fixture = TestBed.createComponent(DeletedUserAvatarComponent);
    fixture.componentRef.setInput('size', 40);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.deleted-user-avatar') as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.width).toBe('40px');
    expect((el.querySelector('i') as HTMLElement).style.fontSize).toBe('17px');
    expect(el.querySelector('i')?.classList).toContain('pi-user');
  });

  it('name renders the translation key as plain text with no link', () => {
    const fixture = TestBed.createComponent(DeletedUserNameComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('common.deletedUser');
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });
});
