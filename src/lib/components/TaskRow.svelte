<script lang="ts">
  import { i18n, t } from '../i18n.svelte';
  import type { Task } from '../db/schema';
  import { daysFromToday, formatDue, formatDuration } from '../utils/date';

  let {
    task,
    listName,
    activeTag,
    mutedTags,
    selected,
    ontoggle,
    onedit,
    ontag,
  }: {
    task: Task;
    /** 「すべて」表示時に所属リスト名を出す（INBOX タスクでは undefined） */
    listName?: string;
    /** タグ絞り込み中のタグ（一致するチップを強調） */
    activeTag?: string | null;
    /** 非表示にするタグ（行のチップからも消える） */
    mutedTags?: string[];
    /** 一括バーで選択中か */
    selected?: boolean;
    /** チェックボックスは「一括操作への選択」。完了・延期はバーから実行する */
    ontoggle: (id: string, selected: boolean) => void;
    onedit: (id: string) => void;
    ontag: (tag: string) => void;
  } = $props();

  const overdue = $derived(
    task.completedAt === undefined && task.due !== undefined && daysFromToday(task.due) < 0,
  );
  const visibleTags = $derived(task.tags.filter((tag) => !(mutedTags ?? []).includes(tag)));
  const notePreview = $derived((task.notes ?? '').split('\n')[0].trim().slice(0, 80));
</script>

<li class="row" class:done={task.completedAt !== undefined} class:picked={selected}>
  <input
    type="checkbox"
    checked={!!selected}
    aria-label={
      selected
        ? t('ariaUnselectTask', { title: task.title })
        : t('ariaSelectTask', { title: task.title })
    }
    onchange={(e) => ontoggle(task.id, e.currentTarget.checked)}
  />
  <div class="title-cell">
    <button
      class="link-title"
      aria-label={t('ariaEdit', { title: task.title })}
      onclick={() => onedit(task.id)}
    >
      {task.title}
    </button>
    {#if notePreview}
      <span class="note-preview" title={task.notes}>📝 {notePreview}</span>
    {/if}
  </div>
  <span class="meta">
    {#if task.priority}<span class="prio p{task.priority}">!{task.priority}</span>{/if}
    {#if task.estimateMinutes}
      <span class="estimate">{formatDuration(task.estimateMinutes, i18n.locale)}</span>
    {/if}
    {#if task.due}
      <span class="due" class:overdue>
        {formatDue(task.due, i18n.locale)}{task.dueTime ? ` ${task.dueTime}` : ''}
      </span>
    {/if}
    {#each visibleTags as tag}
      <button
        class="tag tag-btn"
        class:active={activeTag === tag}
        aria-label={t('ariaTagFilter', { tag })}
        onclick={() => ontag(tag)}>#{tag}</button
      >
    {/each}
    {#if listName}<span class="list-chip">{listName}</span>{/if}
  </span>
</li>
