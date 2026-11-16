import { categoryDisplayName, flatCategoryDisplayName } from './category-name.utils';

describe('categoryDisplayName', () => {
  const category = { name: 'Role play', nameHy: 'Դերախաղեր', nameRu: 'Сюжетно-ролевые игры' };

  it('returns the name for the requested language', () => {
    expect(categoryDisplayName(category, 'en')).toBe('Role play');
    expect(categoryDisplayName(category, 'hy')).toBe('Դերախաղեր');
    expect(categoryDisplayName(category, 'ru')).toBe('Сюжетно-ролевые игры');
  });

  it('falls back to the English name when hy/ru is blank or missing', () => {
    expect(categoryDisplayName({ name: 'Puzzles', nameHy: '', nameRu: '   ' }, 'hy')).toBe('Puzzles');
    expect(categoryDisplayName({ name: 'Puzzles', nameHy: '', nameRu: '   ' }, 'ru')).toBe('Puzzles');
    expect(categoryDisplayName({ name: 'Puzzles' }, 'ru')).toBe('Puzzles');
    expect(categoryDisplayName({ name: 'Puzzles', nameHy: null }, 'hy')).toBe('Puzzles');
  });

  it('never returns null/undefined', () => {
    expect(categoryDisplayName({ name: null }, 'en')).toBe('');
  });
});

describe('flatCategoryDisplayName', () => {
  it('maps the flat DTO shape', () => {
    expect(flatCategoryDisplayName('Toys', 'Խաղալիք', null, 'hy')).toBe('Խաղալիք');
    expect(flatCategoryDisplayName('Toys', 'Խաղալիք', null, 'ru')).toBe('Toys');
    expect(flatCategoryDisplayName(null, null, null, 'en')).toBe('');
  });
});
