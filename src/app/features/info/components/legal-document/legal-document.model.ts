/**
 * Shape of the legal texts kept in `public/i18n/*.json` under `info.privacy` / `info.terms`.
 * Inline markup inside any string: `**bold**`; the support e-mail address is rendered as a mailto link.
 */
export interface LegalListItem {
  readonly text: string;
  /** Nested bullets under this item. */
  readonly items?: readonly LegalListEntry[];
  /** A paragraph that continues the item after its nested bullets. */
  readonly note?: string;
}

export type LegalListEntry = string | LegalListItem;

export interface LegalBlock {
  /** Paragraph. */
  readonly p?: string;
  /** Bold lead-in rendered as a sub-heading. */
  readonly heading?: string;
  /** Bullet list. */
  readonly list?: readonly LegalListEntry[];
}

export interface LegalSection {
  readonly title: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalInlinePart {
  readonly text: string;
  readonly bold: boolean;
  readonly mail: boolean;
}

const BOLD = /\*\*(.+?)\*\*/g;
const MAIL = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;

/** Splits a string into plain / bold / mailto parts so the template can render them with plain bindings. */
export function parseInline(value: string): LegalInlinePart[] {
  const parts: LegalInlinePart[] = [];
  let last = 0;
  const push = (chunk: string, bold: boolean): void => {
    // split() with a capture group puts every matched e-mail address at an odd index
    chunk.split(MAIL).forEach((piece, index) => {
      if (piece) parts.push({ text: piece, bold, mail: index % 2 === 1 });
    });
  };
  for (const match of value.matchAll(BOLD)) {
    push(value.slice(last, match.index), false);
    push(match[1], true);
    last = match.index + match[0].length;
  }
  push(value.slice(last), false);
  return parts;
}

export function asItem(entry: LegalListEntry): LegalListItem {
  return typeof entry === 'string' ? { text: entry } : entry;
}
