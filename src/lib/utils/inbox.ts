/**
 * inbox.md（1 行 = 1 タスク）の行の前処理。
 * Markdown の箇条書き・タスクリスト記号を取り除き、クイック追加パーサーに
 * 渡せる行だけを残す。
 */
export function parseInboxLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:[-*+]\s+(?:\[[ xX]\]\s*)?)/, '').trim())
    // 箇条書き記号だけの行はタスクにならないので除く
    .filter((line) => line && !/^[*+-]\s*$/.test(line));
}
