<script lang="ts">
  import { i18n, t } from '../i18n.svelte';
  import type { Task } from '../db/schema';
  import { daysFromToday, formatDue, formatDuration } from '../utils/date';

  let {
    task,
    listName,
    ontoggle,
    ondelete,
    onedit,
  }: {
    task: Task;
    /** 「すべて」表示時に所属リスト名を出す（INBOX タスクでは undefined） */
    listName?: string;
    ontoggle: (id: string, completed: boolean) => void;
    ondelete: (id: string) => void;
    onedit: (id: string) => void;
  } = $props();

  const overdue = $derived(
    task.completedAt === undefined && task.due !== undefined && daysFromToday(task.due) < 0,
  );
</script>

<li class="row" class:done={task.completedAt !== undefined}>
  <input
    type="checkbox"
    checked={task.completedAt !== undefined}
    aria-label={
      task.completedAt !== undefined
        ? t('ariaReopen', { title: task.title })
        : t('ariaComplete', { title: task.title })
    }
    onchange={(e) => ontoggle(task.id, e.currentTarget.checked)}
  />
  <button
    class="link-title"
    aria-label={t('ariaEdit', { title: task.title })}
    onclick={() => onedit(task.id)}
  >
    {task.title}
  </button>
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
    {#each task.tags as tag}<span class="tag">#{tag}</span>{/each}
    {#if listName}<span class="list-chip">{listName}</span>{/if}
  </span>
  <button
    class="delete"
    aria-label={t('ariaDelete', { title: task.title })}
    onclick={() => ondelete(task.id)}>×</button
  >
</li>
