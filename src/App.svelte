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
    exportAll,
    importBackup,
    observeLists,
    observeVisibleTasks,
    setCompleted,
    softDeleteTask,
    updateTask,
  } from './lib/db/taskRepository';
  import { addDays, formatDuration, formatTodayLong, todayISO } from './lib/utils/date';
  import { parseTaskInput, type ParsedTask } from './lib/utils/parseTask';
  import { sortTasks, type SortMode } from './lib/utils/sorting';

  const SORT_KEY = 'openmilk.sort';

  let tasks = $state<Task[]>([]);
  let lists = $state<List[]>([]);
  let loaded = $state(false);
  let selected = $state('inbox');
  let editingId = $state<string | null>(null);
  let sortMode = $state<SortMode>(loadSortMode());
  let dataStatus = $state('');
  let dueFilter = $state<'today' | 'tomorrow' | 'week' | null>(null);

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
    void handleAddParam();
    return () => {
      unsubscribeTasks();
      unsubscribeLists();
    };
  });

  /** エージェント向け入口: /?add=<クイック追加1行> でタスク登録して URL を掃除する */
  async function handleAddParam() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('add');
    if (!raw) return;
    window.history.replaceState(null, '', window.location.pathname);
    // 自動化のリトライで同じ URL が開き直っても重複しないよう、
    // 直近 10 分以内に処理した同じ1行は無視する
    if (seenRecently(raw)) return;
    const parsed = parseTaskInput(raw);
    if (!parsed.title) return;
    await createTask({
      ...parsed,
      listId: selected === 'all' || selected === 'inbox' ? undefined : selected,
    });
  }

  const ADD_LOG_KEY = 'openmilk.addlog';
  const ADD_LOG_WINDOW_MS = 10 * 60 * 1000;

  /** ?add= の再実行（自動化リトライ）による重複登録を防ぐ */
  function seenRecently(raw: string): boolean {
    try {
      const now = Date.now();
      const log = (
        JSON.parse(localStorage.getItem(ADD_LOG_KEY) ?? '[]') as { h: string; t: number }[]
      ).filter((entry) => now - entry.t < ADD_LOG_WINDOW_MS);
      if (log.some((entry) => entry.h === raw)) {
        localStorage.setItem(ADD_LOG_KEY, JSON.stringify(log));
        return true;
      }
      log.push({ h: raw, t: now });
      localStorage.setItem(ADD_LOG_KEY, JSON.stringify(log.slice(-50)));
    } catch {
      // localStorage が使えない環境では重複チェックなしで進む
    }
    return false;
  }

  function flashDataStatus(message: string) {
    dataStatus = message;
    window.setTimeout(() => {
      dataStatus = '';
    }, 4000);
  }

  async function exportData() {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `openmilk-backup-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    flashDataStatus(t('dataExported'));
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const count = await importBackup(data);
      flashDataStatus(t('importDone', { n: count }));
    } catch {
      flashDataStatus(t('importInvalid'));
    }
  }

  const editingTask = $derived(editingId ? (tasks.find((t) => t.id === editingId) ?? null) : null);

  const sortOptions = $derived([
    { value: 'due', label: t('sortDue') },
    { value: 'priority', label: t('sortPriority') },
    { value: 'created', label: t('sortCreated') },
  ] as const);

  const visibleTasks = $derived.by(() => {
    const t0 = todayISO();
    const tomorrow = addDays(t0, 1);
    const weekEnd = addDays(t0, 7);
    const filtered = tasks.filter((task) => {
      const inSelectedList =
        selected === 'all' || (selected === 'inbox' ? !task.listId : task.listId === selected);
      if (!inSelectedList) return false;
      if (dueFilter === null) return true;
      if (!task.due) return false;
      if (dueFilter === 'today') return task.due <= t0; // 期限切れは今日の仕事に含める
      if (dueFilter === 'tomorrow') return task.due === tomorrow;
      return task.due >= t0 && task.due <= weekEnd;
    });
    return sortTasks(filtered, sortMode);
  });

  /** サイドバーの 今日/明日/1週間 ボタンに表示する未完了件数 */
  const rangeCounts = $derived.by(() => {
    const t0 = todayISO();
    const tomorrow = addDays(t0, 1);
    const weekEnd = addDays(t0, 7);
    let today = 0;
    let tomorrowCount = 0;
    let week = 0;
    for (const task of tasks) {
      if (task.completedAt !== undefined || !task.due) continue;
      if (task.due <= t0) today += 1;
      if (task.due === tomorrow) tomorrowCount += 1;
      if (task.due >= t0 && task.due <= weekEnd) week += 1;
    }
    return { today, tomorrow: tomorrowCount, week };
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
    {rangeCounts}
    {dueFilter}
    {dataStatus}
    onselect={(id) => (selected = id)}
    oncreate={addList}
    ondelete={removeList}
    onexport={exportData}
    onimportFile={importData}
    onsetDueFilter={(filter) => (dueFilter = filter)}
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
