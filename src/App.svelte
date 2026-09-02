<script lang="ts">
  import { onMount } from 'svelte';
  import QuickAdd from './lib/components/QuickAdd.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import TaskEditDialog, { type TaskEdits } from './lib/components/TaskEditDialog.svelte';
  import TaskRow from './lib/components/TaskRow.svelte';
  import { i18n, t } from './lib/i18n.svelte';
  import type { List, Task } from './lib/db/schema';
  import {
    createList,
    createTask,
    deleteList,
    observeLists,
    observeVisibleTasks,
    setCompleted,
    softDeleteTask,
    updateTask,
  } from './lib/db/taskRepository';
  import { formatDuration, formatTodayLong, todayISO } from './lib/utils/date';
  import type { ParsedTask } from './lib/utils/parseTask';
  import { sortTasks, type SortMode } from './lib/utils/sorting';

  const SORT_KEY = 'openmilk.sort';

  let tasks = $state<Task[]>([]);
  let lists = $state<List[]>([]);
  let loaded = $state(false);
  let selected = $state('inbox');
  let editingId = $state<string | null>(null);
  let sortMode = $state<SortMode>(loadSortMode());

  function loadSortMode(): SortMode {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      if (saved === 'due' || saved === 'priority' || saved === 'created') return saved;
    } catch {
      // localStorage が使えない環境ではデフォルトのまま
    }
    return 'due';
  }

  $effect(() => {
    try {
      localStorage.setItem(SORT_KEY, sortMode);
    } catch {
      // 保存できなくても動作には影響しない
    }
  });

  onMount(() => {
    const unsubscribeTasks = observeVisibleTasks((list) => {
      tasks = list;
      loaded = true;
    });
    const unsubscribeLists = observeLists((list) => {
      lists = list;
    });
    return () => {
      unsubscribeTasks();
      unsubscribeLists();
    };
  });

  const editingTask = $derived(editingId ? (tasks.find((t) => t.id === editingId) ?? null) : null);

  const sortOptions = $derived([
    { value: 'due', label: t('sortDue') },
    { value: 'priority', label: t('sortPriority') },
    { value: 'created', label: t('sortCreated') },
  ] as const);

  const visibleTasks = $derived.by(() => {
    const filtered = tasks.filter((task) => {
      if (selected === 'all') return true;
      if (selected === 'inbox') return !task.listId;
      return task.listId === selected;
    });
    return sortTasks(filtered, sortMode);
  });

  const remaining = $derived(visibleTasks.filter((task) => task.completedAt === undefined).length);

  const counts = $derived.by(() => {
    const result: Record<string, number> = { all: 0, inbox: 0 };
    for (const task of tasks) {
      if (task.completedAt !== undefined) continue;
      result.all += 1;
      if (task.listId) result[task.listId] = (result[task.listId] ?? 0) + 1;
      else result.inbox += 1;
    }
    return result;
  });

  /** 今日（+期限切れ）の未完了タスクの見積もり合計 */
  const todayMinutes = $derived(
    tasks
      .filter(
        (task) =>
          task.completedAt === undefined &&
          task.due !== undefined &&
          task.due <= todayISO() &&
          task.estimateMinutes,
      )
      .reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0),
  );

  const currentListName = $derived(
    selected === 'all'
      ? t('allLists')
      : selected === 'inbox'
        ? t('inbox')
        : (lists.find((l) => l.id === selected)?.name ?? ''),
  );

  async function addTask(parsed: ParsedTask) {
    await createTask({
      ...parsed,
      // 「すべて」表示中に追加したものは INBOX へ
      listId: selected === 'all' || selected === 'inbox' ? undefined : selected,
    });
  }

  async function addList(name: string) {
    const list = await createList(name);
    // 作成したリストに切り替える（そのままタスクを追加できるように）
    selected = list.id;
  }

  async function removeList(id: string) {
    await deleteList(id);
    // 表示中のリストを消した場合は INBOX へ戻る
    if (selected === id) selected = 'inbox';
  }

  async function saveEdit(id: string, edits: TaskEdits) {
    await updateTask(id, edits);
    editingId = null;
  }
</script>

<div class="layout">
  <Sidebar
    {lists}
    selected={selected}
    {counts}
    onselect={(id) => (selected = id)}
    oncreate={addList}
    ondelete={removeList}
  />

  <main>
    <header class="top">
      <div class="title-block">
        <h1>{currentListName}</h1>
        <span class="today">{formatTodayLong(i18n.locale)}</span>
      </div>
      <label class="sort">
        <span>{t('sortLabel')}</span>
        <select bind:value={sortMode} aria-label={t('sortLabel')}>
          {#each sortOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </header>

    <QuickAdd onadd={addTask} />

    {#if !loaded}
      <p class="empty">{t('loading')}</p>
    {:else if visibleTasks.length === 0}
      <p class="empty">
        {t('noTasks')}<br />
        {t('examplePrefix')} <code>{t('exampleTask')}</code>
      </p>
    {:else}
      <ul class="tasks">
        {#each visibleTasks as task (task.id)}
          <TaskRow
            {task}
            listName={lists.find((l) => l.id === task.listId)?.name}
            ontoggle={(id, completed) => setCompleted(id, completed)}
            ondelete={softDeleteTask}
            onedit={(id) => (editingId = id)}
          />
        {/each}
      </ul>
      <p class="footer">
        {t('remaining', { n: remaining, total: visibleTasks.length })}
        {#if todayMinutes > 0}
          · {t('todayTotal', { duration: formatDuration(todayMinutes, i18n.locale) })}
        {/if}
      </p>
    {/if}
  </main>
</div>

{#if editingTask}
  <TaskEditDialog
    task={editingTask}
    {lists}
    onsave={saveEdit}
    onclose={() => (editingId = null)}
  />
{/if}
