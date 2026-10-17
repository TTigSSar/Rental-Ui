import en from '../../../../public/i18n/en.json';
import hy from '../../../../public/i18n/hy.json';
import ru from '../../../../public/i18n/ru.json';

type Leaf = Record<string, string>;

/** Flattens nested objects/arrays into `a.b.0.c` -> string leaves. */
function flatten(node: unknown, prefix = '', out: Leaf = {}): Leaf {
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out[prefix] = String(node);
  }
  return out;
}

const bundles: Record<string, Leaf> = {
  en: flatten(en),
  hy: flatten(hy),
  ru: flatten(ru),
};

describe('i18n bundles', () => {
  const allKeys = new Set(Object.values(bundles).flatMap((b) => Object.keys(b)));

  for (const [lang, bundle] of Object.entries(bundles)) {
    it(`${lang} has every key present in any language`, () => {
      const missing = [...allKeys].filter((k) => !(k in bundle)).sort();
      expect(
        missing,
        `${lang}.json is missing ${missing.length} key(s):\n${missing.join('\n')}`,
      ).toEqual([]);
    });

    it(`${lang} has no empty-string values`, () => {
      const empty = Object.entries(bundle)
        .filter(([, v]) => v.trim() === '')
        .map(([k]) => k);
      expect(empty, `${lang}.json has empty values:\n${empty.join('\n')}`).toEqual([]);
    });
  }
});
