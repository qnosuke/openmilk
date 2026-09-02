<script lang="ts">
  import { onMount } from 'svelte';
  import QuickAdd from './lib/components/QuickAdd.svelte';
  import TaskRow from './lib/components/TaskRow.svelte';
  import type { Task } from './lib/db/schema';
  import {
    createTask,
    observeVisibleTasks,
    setCompleted,
    softDeleteTask,
  } from './lib/db/taskRepository';
  import { formatTodayLong } from './lib/utils/date';
  import type { ParsedTask } from './lib/utils/parseTask';

  let tasks = $state<Task[]>([]);
  let loaded = $state(false);

  const remaining = $derived(tasks.filter((t) => t.completedAt === undefined).length);

  onMount(() =>
    observeVisibleTasks((list) => {
      tasks = list;
      loaded = true;
    }),
  );

  async function addTask(parsed: ParsedTask) {
    await createTask(parsed);
  }
</script>

<main>
  <header class="top">
    <h1>🥛 openmilk</h1>
    <span class="today">{formatTodayLong()}</span>
  </header>

  <QuickAdd onadd={addTask} />

  {#if !loaded}
    <p class="empty">読み込み中…</p>
  {:else if tasks.length === 0}
    <p class="empty">
      タスクはまだありません。<br />
      例: <code>牛乳を買う 明日 !2 #買い物</code>
    </p>
  {:else}
    <ul class="tasks">
      {#each tasks as task (task.id)}
        <TaskRow
          {task}
          ontoggle={(id, completed) => setCompleted(id, completed)}
          ondelete={softDeleteTask}
        />
      {/each}
    </ul>
    <p class="footer">残り {remaining} 件 / 全 {tasks.length} 件</p>
  {/if}
</main>
