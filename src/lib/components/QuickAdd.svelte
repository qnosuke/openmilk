<script lang="ts">
  import { i18n, t } from '../i18n.svelte';
  import { formatDue, formatDuration } from '../utils/date';
  import { parseTaskInput, type ParsedTask } from '../utils/parseTask';

  let { onadd }: { onadd: (parsed: ParsedTask) => void } = $props();

  let text = $state('');

  const parsed = $derived(text.trim().length > 0 ? parseTaskInput(text) : undefined);

  const preview = $derived.by(() => {
    if (!parsed?.title) return '';
    const parts: string[] = [];
    if (parsed.due) {
      parts.push(
        `${t('prevDue')}: ${formatDue(parsed.due, i18n.locale)}${parsed.dueTime ? ` ${parsed.dueTime}` : ''}`,
      );
    }
    if (parsed.priority) parts.push(`${t('prevPriority')}: !${parsed.priority}`);
    if (parsed.estimateMinutes) {
      parts.push(`${t('prevEstimate')}: ${formatDuration(parsed.estimateMinutes, i18n.locale)}`);
    }
    if (parsed.tags.length > 0) {
      parts.push(`${t('prevTags')}: ${parsed.tags.map((tag) => `#${tag}`).join(' ')}`);
    }
    return parts.join('　·　');
  });

  function submit(event?: SubmitEvent) {
    event?.preventDefault();
    if (!parsed?.title) return;
    onadd(parsed);
    text = '';
  }

  // フォームの暗黙的な submit が働かない環境（webview・自動化）でも
  // Enter で確定できるようにする
  function handleKeydown(event: KeyboardEvent) {
    // IME 変換の確定に使われた Enter は無視する
    // （keyCode 229 は Safari が変換確定の Enter に返すレガシー値）
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }
</script>

<form class="quick-add" onsubmit={(e) => submit(e)}>
  <input
    type="text"
    placeholder={t('addPlaceholder')}
    aria-label={t('add')}
    bind:value={text}
    onkeydown={handleKeydown}
  />
  <button type="submit" disabled={!parsed?.title}>{t('add')}</button>
</form>
{#if preview}
  <p class="preview" role="status">{preview}</p>
{/if}
