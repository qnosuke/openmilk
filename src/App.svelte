<script lang="ts">
  import { onMount } from 'svelte';
  import QuickAdd from './lib/components/QuickAdd.svelte';
  import Sidebar, { UNTAGGED } from './lib/components/Sidebar.svelte';
  import TaskEditDialog, { type TaskEdits } from './lib/components/TaskEditDialog.svelte';
  import TaskRow from './lib/components/TaskRow.svelte';
  import { i18n, t } from './lib/i18n.svelte';
  import type { List, Task } from './lib/db/schema';
  import {
    createList,
    createTask,
    deleteCompletedTasks,
    deleteList,
    ensureFixedLists,
    exportAll,
    importBackup,
    observeLists,
    observeVisibleTasks,
    postponeTasks,
    purgeExpiredTrash,
    restoreTasks,
    setCompleted,
    softDeleteTask,
    updateTask,
  } from './lib/db/taskRepository';
  import {
    addDays,
    formatDuration,
    formatTodayLong,
    fromISODate,
    todayISO,
  } from './lib/utils/date';
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
  let dueFilter = $state<'overdue' | 'today' | 'tomorrow' | 'week' | null>(null);
  let tagFilter = $state<string | null>(null);
  let searchQuery = $state('');
  let selectedIds = $state<string[]>([]);
  let mutedTags = $state<string[]>(loadMutedTags());
  let view = $state<'active' | 'completed' | 'trash'>('active');

  const MUTED_KEY = 'openmilk.mutedTags';

  function loadMutedTags(): string[] {
    try {
      const saved = JSON.parse(localStorage.getItem(MUTED_KEY) ?? '[]');
      if (Array.isArray(saved)) return saved.filter((s) => typeof s === 'string');
    } catch {
      // localStorage が使えない環境では非表示タグなし
    }
    return [];
  }

  $effect(() => {
    try {
      localStorage.setItem(MUTED_KEY, JSON.stringify(mutedTags));
    } catch {
      // 保存できなくても動作には影響しない
    }
  });

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
    void ensureFixedLists();
    void purgeExpiredTrash();
    // リマインダー: 30秒ごとに予定時刻の到達をチェック
    const reminderInterval = window.setInterval(() => checkReminders(), 30_000);
    // デバッグ・自動テスト用
    (window as unknown as Record<string, unknown>).__openmilk = { checkReminders };
    return () => {
      window.clearInterval(reminderInterval);
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
      // 移行元の固定リストが重複して入る可能性があるため、すぐに自己修復させる
      await ensureFixedLists();
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
    const q = searchQuery.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      // ゴミ箱ビューでは削除済みだけ、他のビューでは削除済みを除く
      if (view === 'trash' ? !task.deleted : task.deleted) return false;
      const inSelectedList =
        selected === 'all' || (selected === 'inbox' ? !task.listId : task.listId === selected);
      if (!inSelectedList) return false;
      if (tagFilter === UNTAGGED) {
        if (task.tags.length > 0) return false;
      } else if (tagFilter !== null && !task.tags.includes(tagFilter)) return false;
      // 非表示タグのついたタスクは全部のビューから消える
      if (task.tags.some((tag) => mutedTags.includes(tag))) return false;
      // 通常ビューは未完了だけ。完了済みは「完了」タブで見る
      if (view === 'active' ? task.completedAt !== undefined : task.completedAt === undefined) {
        return false;
      }
      if (q) {
        const haystack = `${task.title}\n${task.notes ?? ''}\n${task.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (dueFilter === null) return true;
      if (!task.due) return false;
      // 期限切れは独立ボタン。今日=当日のみ
      if (dueFilter === 'overdue') return task.due < t0;
      if (dueFilter === 'today') return task.due === t0;
      if (dueFilter === 'tomorrow') return task.due === tomorrow;
      return task.due >= t0 && task.due <= weekEnd;
    });
    return sortTasks(filtered, sortMode);
  });

  /** サイドバーの期間タイルに表示する未完了件数 */
  const rangeCounts = $derived.by(() => {
    const t0 = todayISO();
    const tomorrow = addDays(t0, 1);
    const weekEnd = addDays(t0, 7);
    let overdue = 0;
    let today = 0;
    let tomorrowCount = 0;
    let week = 0;
    for (const task of tasks) {
      if (task.completedAt !== undefined || task.deleted || !task.due) continue;
      if (task.due < t0) overdue += 1;
      if (task.due === t0) today += 1;
      if (task.due === tomorrow) tomorrowCount += 1;
      if (task.due >= t0 && task.due <= weekEnd) week += 1;
    }
    return { overdue, today, tomorrow: tomorrowCount, week };
  });

  const remaining = $derived(visibleTasks.filter((task) => task.completedAt === undefined).length);

  const counts = $derived.by(() => {
    const result: Record<string, number> = { all: 0, inbox: 0 };
    for (const task of tasks) {
      if (task.completedAt !== undefined || task.deleted) continue;
      result.all += 1;
      if (task.listId) result[task.listId] = (result[task.listId] ?? 0) + 1;
      else result.inbox += 1;
    }
    return result;
  });

  /**
   * フッターの「今日の作業予定」: 今の表示コンテキスト（リスト・タグ絞り込み・
   * ミュート）で見えている、今日期限の未完了タスクの見積もり合計
   */
  const todayMinutes = $derived.by(() => {
    const t0 = todayISO();
    return tasks
      .filter((task) => {
        if (task.completedAt !== undefined || task.deleted) return false;
        if (selected !== 'all') {
          const inList = selected === 'inbox' ? !task.listId : task.listId === selected;
          if (!inList) return false;
        }
        if (tagFilter && !task.tags.includes(tagFilter)) return false;
        if (mutedTags.some((tag) => task.tags.includes(tag))) return false;
        return task.due !== undefined && task.due <= t0 && !!task.estimateMinutes;
      })
      .reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  });

  /** サイドバーのタグクラウド: 未完了タスクのタグ出現数（多い順） */
  const tagCounts = $derived.by(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.completedAt !== undefined || task.deleted) continue;
      for (const tag of task.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count, muted: mutedTags.includes(name) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  const untaggedCount = $derived(
    tasks.filter((t) => t.completedAt === undefined && t.tags.length === 0).length,
  );

  const completedCount = $derived(
    tasks.filter((t) => t.completedAt !== undefined && !t.deleted).length,
  );

  function toggleMutedTag(tag: string) {
    mutedTags = mutedTags.includes(tag) ? mutedTags.filter((t) => t !== tag) : [...mutedTags, tag];
  }

  /** タグクラウドのクリック: 非表示中タグならミュート解除、それ以外は絞り込みトグル */
  function handleTagClick(tag: string) {
    if (mutedTags.includes(tag)) {
      toggleMutedTag(tag);
      return;
    }
    tagFilter = tagFilter === tag ? null : tag;
  }

  const currentListName = $derived(
    selected === 'all'
      ? t('allLists')
      : selected === 'inbox'
        ? t('inbox')
        : (lists.find((l) => l.id === selected)?.name ?? ''),
  );

  async function addTask(parsed: ParsedTask) {
    // タグ絞り込み中の追加はそのタグを自動で付ける（タグなし絞り込み中は付けない）
    const tags =
      tagFilter && tagFilter !== UNTAGGED && !parsed.tags.includes(tagFilter)
        ? [...parsed.tags, tagFilter]
        : parsed.tags;
    await createTask({
      ...parsed,
      tags,
      // 「すべて」表示中に追加したものは INBOX へ
      listId: selected === 'all' || selected === 'inbox' ? undefined : selected,
    });
  }

  const allVisibleSelected = $derived(
    visibleTasks.length > 0 && visibleTasks.every((t) => selectedIds.includes(t.id)),
  );

  function toggleSelectAll(checked: boolean) {
    selectedIds = checked ? visibleTasks.map((t) => t.id) : [];
  }

  async function addList(name: string) {
    const list = await createList(name);
    // 作成したリストに切り替える（そのままタスクを追加できるように）
    selected = list.id;
  }

  function clearSelection() {
    selectedIds = [];
  }

  async function completeSelected() {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => setCompleted(id, true)));
    selectedIds = [];
  }

  async function restoreSelected() {
    await restoreTasks([...selectedIds]);
    selectedIds = [];
  }

  async function reopenSelected() {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => setCompleted(id, false)));
    selectedIds = [];
  }

  async function postponeSelected() {
    const ids = [...selectedIds];
    await postponeTasks(ids);
    selectedIds = [];
  }

  const selectedAllCompleted = $derived(
    selectedIds.length > 0 &&
      selectedIds.every((id) => tasks.find((t) => t.id === id)?.completedAt !== undefined),
  );

  async function removeList(id: string) {
    await deleteList(id);
    // 表示中のリストを消した場合は INBOX へ戻る
    if (selected === id) selected = 'inbox';
  }

  // --- リマインダー ---
  function dueMomentMs(task: Task): number | null {
    if (!task.due) return null;
    const [h, m] = (task.dueTime ?? '09:00').split(':').map(Number);
    const d = fromISODate(task.due);
    d.setHours(h, m ?? 0, 0, 0);
    return d.getTime();
  }

  function checkReminders() {
    const now = Date.now();
    let notified: Record<string, number> = {};
    try {
      notified = JSON.parse(localStorage.getItem('openmilk.notified') ?? '{}');
    } catch {
      notified = {};
    }
    for (const task of tasks) {
      if (task.completedAt !== undefined || task.deleted || !task.remindMinutesBefore) continue;
      const moment = dueMomentMs(task);
      if (moment === null) continue;
      const fireAt = moment - task.remindMinutesBefore * 60_000;
      // 予定時刻を過ぎてから6時間以内のリマインダーを1回だけ通知する
      if (fireAt > now || now - fireAt > 6 * 3_600_000) continue;
      const key = `${task.id}:${task.due}:${task.dueTime ?? ''}`;
      if (notified[key]) continue;
      notified[key] = now;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification(t('reminderTitle'), {
          body: task.title,
          tag: task.id,
          icon: '/icons/milk-192.png',
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    }
    try {
      localStorage.setItem('openmilk.notified', JSON.stringify(notified));
    } catch {
      // 保存できない場合は次回も再度通知判定が行われる
    }
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
    {tagCounts}
    {mutedTags}
    {untaggedCount}
    activeTag={tagFilter}
    {dueFilter}
    search={searchQuery}
    {dataStatus}
    completedCount={completedCount}
    onselect={(id) => (selected = id)}
    oncreate={addList}
    ondelete={removeList}
    onexport={exportData}
    onimportFile={importData}
    onsearch={(query) => (searchQuery = query)}
    onsetDueFilter={(filter) => (dueFilter = filter)}
    onselectTag={handleTagClick}
    ontoggleMute={toggleMutedTag}
    onDeleteCompleted={() => {
      deleteCompletedTasks().then((n) => flashDataStatus(t('deletedCompletedN', { n })));
    }}
  />

  <main>
    <header class="top">
      <div class="title-block">
        <h1>{currentListName}</h1>
        <span class="today">{formatTodayLong(i18n.locale)}</span>
      </div>
      {#if tagFilter}
        <button
          class="tag-filter-clear"
          onclick={() => (tagFilter = null)}
          aria-label={t('clearTagFilter')}
        >
          #{tagFilter} ✕
        </button>
      {/if}
      <div class="view-toggle" role="group" aria-label={t('viewAria')}>
        <button
          class:active={view === 'active'}
          onclick={() => (view = 'active')}
          aria-label={t('viewTasks')}
        >
          {t('viewTasks')}
        </button>
        <button
          class:active={view === 'completed'}
          onclick={() => (view = 'completed')}
          aria-label={t('viewCompleted')}
        >
          {t('viewCompleted')}
        </button>
        <button
          class:active={view === 'trash'}
          onclick={() => (view = 'trash')}
          aria-label={t('viewTrash')}
        >
          {t('viewTrash')}
        </button>
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

    {#if selectedIds.length > 0}
      <div class="bulk-bar">
        <label class="bulk-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onchange={(e) => toggleSelectAll(e.currentTarget.checked)}
          />
          {t('selectAll')}
        </label>
        {#if view === 'trash'}
          <button class="bulk-complete" onclick={restoreSelected}>
            {t('restoreN', { n: selectedIds.length })}
          </button>
        {:else if selectedAllCompleted}
          <button class="bulk-complete" onclick={reopenSelected}>
            {t('reopenN', { n: selectedIds.length })}
          </button>
        {:else}
          <button class="bulk-complete" onclick={completeSelected}>
            {t('completeN', { n: selectedIds.length })}
          </button>
          <button class="bulk-postpone" onclick={postponeSelected}>
            {t('postponeN', { n: selectedIds.length })}
          </button>
        {/if}
        <button class="bulk-cancel" onclick={clearSelection}>{t('clearSelection')}</button>
      </div>
    {/if}

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
          activeTag={tagFilter}
          {mutedTags}
          selected={selectedIds.includes(task.id)}
          ontoggle={(id, checked) =>
            (selectedIds = checked
              ? [...selectedIds, id]
              : selectedIds.filter((sid) => sid !== id))}
          onedit={(id) => (editingId = id)}
          ontag={(tag) => (tagFilter = tagFilter === tag ? null : tag)}
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
    ondelete={softDeleteTask}
    onclose={() => (editingId = null)}
  />
{/if}
