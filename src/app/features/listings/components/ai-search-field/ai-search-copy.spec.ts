import en from '../../../../../../public/i18n/en.json';
import hy from '../../../../../../public/i18n/hy.json';
import ru from '../../../../../../public/i18n/ru.json';

/** Approved copy (design-notes 11 and 19). */
describe('AI search copy', () => {
  it('privacy note says the request is processed by AI (design-notes 11)', () => {
    expect(en.listings.ai.privacy).toBe('Your request is processed by AI.');
    expect(ru.listings.ai.privacy).toBe('Ваш запрос обрабатывает искусственный интеллект.');
    expect(hy.listings.ai.privacy).toBe('Ձեր հարցումը մշակում է արհեստական բանականությունը։');
  });

  it('the relevance sort label is short (design-notes 19)', () => {
    expect(en.listings.ai.sortRelevant).toBe('Relevance');
    expect(ru.listings.ai.sortRelevant).toBe('По соответствию');
    expect(hy.listings.ai.sortRelevant).toBe('Համապատասխանության');
  });
});
