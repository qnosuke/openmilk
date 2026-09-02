<script lang="ts">
  import { formatDue } from '../utils/date';
  import { parseTaskInput, type ParsedTask } from '../utils/parseTask';

  let { onadd }: { onadd: (parsed: ParsedTask) => void } = $props();

  let text = $state('');

  const parsed = $derived(text.trim().length > 0 ? parseTaskInput(text) : undefined);

  const preview = $derived.by(() => {
    if (!parsed?.title) return '';
    const parts: string[] = [];
    if (parsed.due) parts.push(`期限: ${formatDue(parsed.due)}`);
    if (parsed.priority) parts.push(`優先度: !${parsed.priority}`);
    if (parsed.tags.length > 0) parts.push(`タグ: ${parsed.tags.map((t) => `#${t}`).join(' ')}`);
    return parts.join('　·　');
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!parsed?.title) return;
    onadd(parsed);
    text = '';
  }
</script>

<form class="quick-add" onsubmit={submit}>
  <input
    type="text"
    placeholder="タスクを追加（例: 牛乳を買う 明日 !2 #買い物）"
    aria-label="タスクを追加"
    bind:value={text}
  />
  <button type="submit" disabled={!parsed?.title}>追加</button>
</form>
{#if preview}
  <p class="preview" role="status">{preview}</p>
{/if}
