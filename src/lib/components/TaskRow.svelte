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
    liveMinutes,
    ontoggle,
    onedit,
    ontag,
    onstartTimer,
    onstopTimer,
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
    /** 計測中の経過（分）。このタスクが計測中のときだけ渡る */
    liveMinutes?: number;
    /** チェックボックスは「一括操作への選択」。完了・延期はバーから実行する */
    ontoggle: (id: string, selected: boolean) => void;
    onedit: (id: string) => void;
    ontag: (tag: string) => void;
    onstartTimer: (id: string) => void;
    onstopTimer: (id: string) => void;
  } = $props();

  const overdue = $derived(
    task.completedAt === undefined && task.due !== undefined && daysFromToday(task.due) < 0,
  );
  const visibleTags = $derived(task.tags.filter((tag) => !(mutedTags ?? []).includes(tag)));
  const notePreview = $derived((task.notes ?? '').split('\n')[0].trim().slice(0, 80));
  const isTracking = $derived(liveMinutes !== undefined);
  const overEstimate = $derived(
    !!task.estimateMinutes && liveMinutes !== undefined && liveMinutes > task.estimateMinutes,
  );
</script>

<li
  class="row"
  class:done={task.completedAt !== undefined}
  class:picked={selected}
  class:tracking={isTracking}
>
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
  {#if task.completedAt === undefined}
    {#if isTracking}
      <button
        class="timer-btn stop"
        aria-label={t('ariaTimerStop', { title: task.title })}
        title={t('ariaTimerStop', { title: task.title })}
        onclick={() => onstopTimer(task.id)}>⏸</button
      >
    {:else}
      <button
        class="timer-btn"
        aria-label={t('ariaTimerStart', { title: task.title })}
        title={t('ariaTimerStart', { title: task.title })}
        onclick={() => onstartTimer(task.id)}>▶</button
      >
    {/if}
  {/if}
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
    {#if isTracking && liveMinutes !== undefined}
      <span class="live-chip" class:over={overEstimate}>
        {formatDuration(Math.max(1, Math.round(liveMinutes)), i18n.locale)}
        {#if task.estimateMinutes}
          / {formatDuration(task.estimateMinutes, i18n.locale)}
        {/if}
      </span>
    {:else if task.trackedMinutes}
      <span class="estimate">
        {t('trackedTotal', { d: formatDuration(task.trackedMinutes, i18n.locale) })}
      </span>
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
