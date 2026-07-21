import type { ListingDistrict } from './district.model';
import { districtDisplayName } from './district-ui.util';

const district: ListingDistrict = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'kentron',
  nameEn: 'Kentron',
  nameHy: 'Կենտրոն',
  nameRu: 'Кентрон',
};

describe('districtDisplayName', () => {
  it('returns the English name for en', () => {
    expect(districtDisplayName(district, 'en')).toBe('Kentron');
  });

  it('returns the Armenian name for hy', () => {
    expect(districtDisplayName(district, 'hy')).toBe('Կենտրոն');
  });

  it('returns the Russian name for ru', () => {
    expect(districtDisplayName(district, 'ru')).toBe('Кентрон');
  });
});
