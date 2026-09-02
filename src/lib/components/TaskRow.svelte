<script lang="ts">
  import type { Task } from '../db/schema';
  import { daysFromToday, formatDue } from '../utils/date';

  let {
    task,
    ontoggle,
    ondelete,
  }: {
    task: Task;
    ontoggle: (id: string, completed: boolean) => void;
    ondelete: (id: string) => void;
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
        ? `「${task.title}」を未完了に戻す`
        : `「${task.title}」を完了にする`
    }
    onchange={(e) => ontoggle(task.id, e.currentTarget.checked)}
  />
  <span class="title">{task.title}</span>
  <span class="meta">
    {#if task.priority}<span class="prio p{task.priority}">!{task.priority}</span>{/if}
    {#if task.due}<span class="due" class:overdue>{formatDue(task.due)}</span>{/if}
    {#each task.tags as tag}<span class="tag">#{tag}</span>{/each}
  </span>
  <button
    class="delete"
    aria-label={`「${task.title}」を削除`}
    onclick={() => ondelete(task.id)}>×</button
  >
</li>
