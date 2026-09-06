/** 検索ヒット部分の分割結果。hit が true の区間をハイライト表示する */
export interface HighlightPart {
  text: string;
  hit: boolean;
}

/**
 * text を query（大文字小文字を区別しない部分一致）で分割する。
 * query が空または見つからない場合は元テキストをそのまま返す
 */
export function splitHighlight(text: string, query: string | undefined | null): HighlightPart[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const parts: HighlightPart[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), hit: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), hit: false });
    parts.push({ text: text.slice(idx, idx + q.length), hit: true });
    i = idx + q.length;
  }
  return parts;
}
