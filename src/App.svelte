<script lang="ts">
  import { onMount } from 'svelte';
  import QuickAdd from './lib/components/QuickAdd.svelte';
  import Sidebar, { UNTAGGED } from './lib/components/Sidebar.svelte';
  import StatsView from './lib/components/StatsView.svelte';
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
    startTaskTimer,
    stopTaskTimer,
    updateTask,
    type BackupData,
    type PostponeAmount,
  } from './lib/db/taskRepository';
  import {
    addDays,
    formatDuration,
    formatTodayLong,
    fromISODate,
    todayISO,
  } from './lib/utils/date';
  import { parseTaskInput, type ParsedTask } from './lib/utils/parseTask';
  import {
    DEFAULT_POMODORO,
    formatPomodoroClock,
    pomodoroPhase,
    type PomodoroSettings,
  } from './lib/utils/pomodoro';
  import { sortTasks, type SortMode } from './lib/utils/sorting';
  import { splitOneLevel } from './lib/utils/subtasks';
  import {
    backupNow,
    chooseBackupFolder,
    disconnectBackupFolder,
    getBackupFolderInfo,
    importInboxFiles,
    isAutoBackupSupported,
    reconnectBackupFolder,
    restoreFromBackupFile,
  } from './lib/backupFolder';

  const SORT_KEY = 'openmilk.sort';
  const POMODORO_KEY = 'openmilk.pomodoro';
  /** 複数行一括追加の上限（誤って巨大テキストを流し込む事故防止） */
  const BULK_ADD_LIMIT = 100;

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
  let view = $state<'active' | 'completed' | 'trash' | 'stats'>('active');
  let nowTick = $state(Date.now());
  let bulkTag = $state('');
  let pomodoro = $state<PomodoroSettings>(loadPomodoro());
  let quickAddRef = $state<{ focus(): void }>();
  let sidebarRef = $state<{ focusSearch(): void }>();
  /** キーボードカーソル（j/k）が当たっている renderedRows のインデックス。-1 は未選択 */
  let cursorIndex = $state(-1);
  const autoBackup = $state({
    supported: isAutoBackupSupported(),
    folderName: null as string | null,
    needsPermission: false,
  });
  let backupTimer: number | undefined;

  function toggleTrash() {
    view = view === 'trash' ? 'active' : 'trash';
  }

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

  function loadPomodoro(): PomodoroSettings {
    try {
      const saved = JSON.parse(localStorage.getItem(POMODORO_KEY) ?? '{}');
      if (typeof saved === 'object' && saved !== null) {
        return { ...DEFAULT_POMODORO, ...saved };
      }
    } catch {
      // localStorage が使えない環境ではデフォルト設定
    }
    return { ...DEFAULT_POMODORO };
  }

  $effect(() => {
    try {
      localStorage.setItem(POMODORO_KEY, JSON.stringify(pomodoro));
    } catch {
      // 保存できなくても動作には影響しない
    }
  });

  function setPomodoro(key: keyof PomodoroSettings, value: number) {
    pomodoro = { ...pomodoro, [key]: value };
  }

  onMount(() => {
    const unsubscribeTasks = observeVisibleTasks((list) => {
      tasks = list;
      loaded = true;
      scheduleAutoBackup();
    });
    const unsubscribeLists = observeLists((list) => {
      lists = list;
      scheduleAutoBackup();
    });
    void handleAddParam();
    void ensureFixedLists();
    void purgeExpiredTrash();
    // 自動バックアップ: 保存済みフォルダがあれば復元して inbox を取り込む
    void (async () => {
      await refreshAutoBackup();
      if (autoBackup.folderName && !autoBackup.needsPermission) await syncInboxAndBackup();
    })();
    // テキストファイル・複数行テキストのドロップで INBOX 一括追加
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    // リマインダー: 30秒ごとに予定時刻の到達をチェック
    const reminderInterval = window.setInterval(() => checkReminders(), 30_000);
    // デバッグ・自動テスト用
    (window as unknown as Record<string, unknown>).__openmilk = { checkReminders };
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
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
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      // JSON として壊れている（転送中の破損など）
      flashDataStatus(t('importInvalid'));
      return;
    }
    if (typeof data !== 'object' || data === null || !Array.isArray((data as BackupData).tasks)) {
      // JSON ではあるが openmilk 形式ではない（RTM のエクスポートをそのまま入れた等）
      flashDataStatus(t('importNotOpenmilk'));
      return;
    }
    try {
      const count = await importBackup(data as BackupData);
      // 移行元の固定リストが重複して入る可能性があるため、すぐに自己修復させる
      await ensureFixedLists();
      flashDataStatus(t('importDone', { n: count }));
    } catch {
      flashDataStatus(t('importInvalid'));
    }
  }

  const editingTask = $derived(editingId ? (tasks.find((t) => t.id === editingId) ?? null) : null);

  /** INBOX は仕分け場所なので追加順（古いものが先）で固定する */
  const effectiveSort = $derived(selected === 'inbox' ? 'added' : sortMode);

  const sortOptions = $derived([
    { value: 'due', label: t('sortDue') },
    { value: 'priority', label: t('sortPriority') },
    { value: 'created', label: t('sortCreated') },
  ] as const);

  const filteredSorted = $derived.by(() => {
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
    return sortTasks(filtered, effectiveSort);
  });

  /** サブタスクは 1 階層限定。親の下にぶら下がる子と、それ以外の通常行に分ける */
  const oneLevel = $derived(splitOneLevel(filteredSorted));

  /** 親が同じビューに見えているサブタスクは行から取り除き、親の下にインデント表示する */
  const visibleTasks = $derived(oneLevel.rows);

  /** 実際に描画する行（親+子を並べたフラットな列。キーボードカーソルもこの順） */
  const renderedRows = $derived.by(() => {
    const list: { task: Task; isChild: boolean }[] = [];
    for (const task of oneLevel.rows) {
      list.push({ task, isChild: false });
      for (const child of oneLevel.childrenByParent.get(task.id) ?? []) {
        list.push({ task: child, isChild: true });
      }
    }
    return list;
  });

  $effect(() => {
    if (cursorIndex >= renderedRows.length) cursorIndex = renderedRows.length - 1;
  });

  $effect(() => {
    if (!isTriage && cursorIndex !== -1) cursorIndex = -1;
  });

  /** 親タスク id → サブタスク進捗（削除済みを除く） */
  const subtaskProgress = $derived.by(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const task of tasks) {
      if (!task.parentId || task.deleted) continue;
      const info = map.get(task.parentId) ?? { done: 0, total: 0 };
      info.total += 1;
      if (task.completedAt !== undefined) info.done += 1;
      map.set(task.parentId, info);
    }
    return map;
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

  const remaining = $derived(filteredSorted.filter((task) => task.completedAt === undefined).length);

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
    view === 'trash'
      ? t('viewTrash')
      : selected === 'all'
        ? t('allLists')
        : selected === 'inbox'
          ? t('inbox')
          : (lists.find((l) => l.id === selected)?.name ?? ''),
  );

  async function addTask(parsed: ParsedTask) {
    await addParsed(parsed);
  }

  async function addParsed(parsed: ParsedTask) {
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

  /** 改行区切りのテキストを 1 行 = 1 タスクで一括追加する（クイック追加の記法が使える） */
  async function addLines(lines: string[]) {
    let added = 0;
    for (const line of lines.slice(0, BULK_ADD_LIMIT)) {
      const parsed = parseTaskInput(line);
      if (!parsed.title) continue;
      await addParsed(parsed);
      added += 1;
    }
    if (added > 0) flashDataStatus(t('bulkAdded', { n: added }));
  }

  function splitBulkLines(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 入力欄へのドロップ（通常のテキスト挿入）は一括追加の対象外にする
  function isEditableTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
    );
  }

  function handleDragOver(event: DragEvent) {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
  }

  function handleDrop(event: DragEvent) {
    if (isEditableTarget(event.target)) return;
    const dt = event.dataTransfer;
    if (!dt) return;
    event.preventDefault();
    const file = dt.files?.[0];
    if (file && /\.(txt|md|csv)$/i.test(file.name)) {
      void file.text().then((text) => addLines(splitBulkLines(text)));
      return;
    }
    const text = dt.getData('text/plain');
    if (text && text.includes('\n')) void addLines(splitBulkLines(text));
  }

  // --- INBOX 仕分けモード ---
  const isTriage = $derived(selected === 'inbox' && view === 'active');

  /** 仕分けモードの移動先（next action / waiting / someday の固定リスト） */
  const triageLists = $derived(
    lists.filter((l) => l.fixed).map((l) => ({ id: l.id, name: l.name })),
  );

  async function moveTriage(id: string, listId: string) {
    await updateTask(id, { listId });
  }

  // --- キーボードショートカット ---
  // 最小セット: / = 検索へ、a = 追加入力へ（全体）。
  // j/k = 行移動、1/2/3 = next action/waiting/someday へ仕分け、x = 完了、
  // e = 編集、Space = 選択（仕分けモードのみ）。

  function isTextEntryTarget(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    );
  }

  function focusCursorRow() {
    const row = renderedRows[cursorIndex];
    if (!row) return;
    (document.querySelector(`[data-task-id="${row.task.id}"]`) as HTMLElement | null)?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    // IME 変換の確定に使われた Enter なども拾わない（keyCode 229 は Safari のレガシー値）
    if (event.isComposing || event.keyCode === 229) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (editingId !== null) return; // 編集ダイアログ中はデフォルトの操作に任せる
    if (isTextEntryTarget(event.target)) return;

    if (event.key === '/') {
      event.preventDefault();
      sidebarRef?.focusSearch();
      return;
    }
    if (event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      quickAddRef?.focus();
      return;
    }
    if (!isTriage || renderedRows.length === 0) return;

    const clamp = (i: number) => Math.max(0, Math.min(renderedRows.length - 1, i));
    const current =
      cursorIndex >= 0 && cursorIndex < renderedRows.length ? renderedRows[cursorIndex] : undefined;

    switch (event.key) {
      case 'j':
      case 'ArrowDown':
        event.preventDefault();
        cursorIndex = clamp(cursorIndex + 1);
        focusCursorRow();
        break;
      case 'k':
      case 'ArrowUp':
        event.preventDefault();
        cursorIndex = clamp(cursorIndex <= 0 ? 0 : cursorIndex - 1);
        focusCursorRow();
        break;
      case '1':
      case '2':
      case '3': {
        const target = triageLists[Number(event.key) - 1];
        if (current && target) {
          event.preventDefault();
          void moveTriage(current.task.id, target.id);
        }
        break;
      }
      case 'x':
        if (current) {
          event.preventDefault();
          void setCompleted(current.task.id, true);
        }
        break;
      case 'e':
        if (current) {
          event.preventDefault();
          editingId = current.task.id;
        }
        break;
      case ' ':
        if (current) {
          event.preventDefault();
          selectedIds = selectedIds.includes(current.task.id)
            ? selectedIds.filter((sid) => sid !== current.task.id)
            : [...selectedIds, current.task.id];
        }
        break;
      case 'Escape':
        if (selectedIds.length > 0) {
          event.preventDefault();
          selectedIds = [];
        } else if (cursorIndex !== -1) {
          cursorIndex = -1;
        }
        break;
    }
  }

  // --- タグの一括追加・削除 ---
  async function applyBulkTag(add: boolean) {
    const tag = bulkTag.trim().replace(/^#/, '');
    if (!tag || selectedIds.length === 0) return;
    const ids = [...selectedIds];
    await Promise.all(
      ids.map((id) => {
        const task = tasks.find((t) => t.id === id);
        if (!task) return Promise.resolve();
        const next = add ? [...new Set([...task.tags, tag])] : task.tags.filter((x) => x !== tag);
        if (next.length === task.tags.length) return Promise.resolve();
        return updateTask(id, { tags: next });
      }),
    );
    bulkTag = '';
  }

  // --- サブタスク分割 ---
  const editingSubtasks = $derived(
    editingId ? tasks.filter((t) => t.parentId === editingId && !t.deleted) : [],
  );

  async function splitTask(id: string, lines: string[]) {
    const parent = tasks.find((t) => t.id === id);
    if (!parent) return;
    let added = 0;
    for (const line of lines.slice(0, BULK_ADD_LIMIT)) {
      const parsed = parseTaskInput(line);
      if (!parsed.title) continue;
      // 親のタグを引き継ぎ、親と同じリストに作る
      const tags = [...new Set([...parent.tags, ...parsed.tags])];
      await createTask({ ...parsed, tags, listId: parent.listId, parentId: id });
      added += 1;
    }
    if (added > 0) flashDataStatus(t('splitAdded', { n: added }));
  }

  // --- 自動バックアップ（File System Access 対応ブラウザのみ） ---

  async function refreshAutoBackup() {
    const info = await getBackupFolderInfo();
    autoBackup.folderName = info.folderName;
    autoBackup.needsPermission = info.needsPermission;
  }

  /** データ変更のたびに呼ばれ、少し待ってからフォルダへ書き出す */
  function scheduleAutoBackup() {
    if (!autoBackup.folderName || autoBackup.needsPermission) return;
    window.clearTimeout(backupTimer);
    backupTimer = window.setTimeout(() => void backupNow(), 3000);
  }

  /** inbox.md / inbox.json の取り込み + フォルダのバックアップからの復元 + 書き出し。
   *  起動時・フォーカス時・フォルダ設定直後に呼ぶ（これが他環境との簡易同期になる） */
  async function syncInboxAndBackup() {
    if (!autoBackup.folderName || autoBackup.needsPermission) return;
    const restored = await restoreFromBackupFile();
    const imported = await importInboxFiles();
    const parts: string[] = [];
    if (restored > 0) parts.push(t('backupRestored', { n: restored }));
    if (imported > 0) parts.push(t('inboxImported', { n: imported }));
    if (parts.length > 0) flashDataStatus(parts.join(' / '));
    await backupNow();
  }

  async function handleChooseBackupFolder() {
    try {
      const name = await chooseBackupFolder();
      if (!name) return;
      await refreshAutoBackup();
      await syncInboxAndBackup();
    } catch {
      // フォルダ選択をキャンセルしただけなので無視する
    }
  }

  async function handleReconnectBackupFolder() {
    await reconnectBackupFolder();
    await refreshAutoBackup();
    await syncInboxAndBackup();
  }

  async function handleDisconnectBackupFolder() {
    await disconnectBackupFolder();
    await refreshAutoBackup();
  }

  const allVisibleSelected = $derived(
    filteredSorted.length > 0 && filteredSorted.every((t) => selectedIds.includes(t.id)),
  );

  function toggleSelectAll(checked: boolean) {
    selectedIds = checked ? filteredSorted.map((t) => t.id) : [];
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

  async function postponeSelected(amount: PostponeAmount) {
    const ids = [...selectedIds];
    await postponeTasks(ids, amount);
    selectedIds = [];
  }

  // 計測中の経過表示を1秒ごとに更新（計測中のみ動く）
  const isAnyTracking = $derived(tasks.some((t) => t.timerStartedAt !== undefined));
  $effect(() => {
    if (!isAnyTracking) return;
    const timer = window.setInterval(() => (nowTick = Date.now()), 1000);
    return () => window.clearInterval(timer);
  });

  /** 計測中タスクの経過（分）。見積もり比較とライブ表示に使う */
  const tracking = $derived.by(() => {
    const t = tasks.find((x) => x.timerStartedAt !== undefined);
    if (!t) return undefined;
    void nowTick;
    const elapsed = (t.trackedMinutes ?? 0) + (Date.now() - new Date(t.timerStartedAt!).getTime()) / 60_000;
    return { id: t.id, minutes: Math.max(0, elapsed) };
  });

  // --- ポモドーロ ---
  /** 計測中タスクに重ねた現在のポモドーロフェーズ（計測中のみ） */
  const pomoLive = $derived.by(() => {
    if (!tracking) return undefined;
    void nowTick;
    return pomodoroPhase(tracking.minutes * 60, pomodoro);
  });

  let lastPomoKey = '';

  // フェーズ切り替わり（集中→休憩→次の集中）で1回だけ通知する
  $effect(() => {
    if (!pomoLive) {
      lastPomoKey = '';
      return;
    }
    const key = `${tracking?.id}:${pomoLive.session}:${pomoLive.phase}`;
    if (key === lastPomoKey) return;
    const resumed = lastPomoKey !== '';
    lastPomoKey = key;
    if (!resumed) return; // 計測開始時には通知しない
    if (pomoLive.phase === 'break' || pomoLive.phase === 'longBreak') {
      const minutes =
        pomoLive.phase === 'longBreak' ? pomodoro.longBreakMinutes : pomodoro.breakMinutes;
      pomodoroNotify(t('pomodoroBreakTitle'), t('pomodoroBreakBody', { min: minutes }));
      bumpPomodoroCount();
    } else if (pomoLive.session > 1) {
      pomodoroNotify(t('pomodoroFocusTitle'), t('pomodoroFocusBody'));
    }
  });

  function pomodoroNotify(title: string, body: string) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification(title, {
        body,
        icon: `${import.meta.env.BASE_URL}icons/milk-192.png`,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } else {
      // 通知権限が無い場合はデータステータス欄で代用する
      flashDataStatus(`${title} — ${body}`);
    }
  }

  /** 今日完了したポモドーロ数（将来の統計の材料。localStorage に置く） */
  function bumpPomodoroCount() {
    try {
      const key = `openmilk.pomo.${todayISO()}`;
      const n = Number(localStorage.getItem(key) ?? '0');
      localStorage.setItem(key, String(n + 1));
    } catch {
      // 保存できなくても動作には影響しない
    }
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
          icon: `${import.meta.env.BASE_URL}icons/milk-192.png`,
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

<svelte:window onkeydown={handleKeydown} onfocus={() => void syncInboxAndBackup()} />

<div class="layout">
  <Sidebar
    bind:this={sidebarRef}
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
    trashActive={view === 'trash'}
    completedCount={completedCount}
    triageActive={isTriage}
    {pomodoro}
    {autoBackup}
    onsetPomodoro={setPomodoro}
    onChooseBackupFolder={() => void handleChooseBackupFolder()}
    onReconnectBackupFolder={() => void handleReconnectBackupFolder()}
    onDisconnectBackupFolder={() => void handleDisconnectBackupFolder()}
    onselect={(id) => (selected = id)}
    oncreate={addList}
    ondelete={removeList}
    onexport={exportData}
    onimportFile={importData}
    onsearch={(query) => (searchQuery = query)}
    onsetDueFilter={(filter) => (dueFilter = filter)}
    onselectTag={handleTagClick}
    ontoggleMute={toggleMutedTag}
    onToggleTrash={toggleTrash}
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
          class:active={view === 'stats'}
          onclick={() => (view = 'stats')}
          aria-label={t('viewStats')}
        >
          {t('viewStats')}
        </button>
      </div>
      {#if pomoLive}
        <span class="pomodoro-chip" class:onbreak={pomoLive.phase !== 'focus'}>
          {pomoLive.phase === 'focus'
            ? t('pomodoroChipFocus', {
                n: pomoLive.session,
                time: formatPomodoroClock(pomoLive.remainingSeconds),
              })
            : t('pomodoroChipBreak', { time: formatPomodoroClock(pomoLive.remainingSeconds) })}
        </span>
      {/if}
      {#if selected !== 'inbox' || view === 'stats'}
        <label class="sort">
          <span>{t('sortLabel')}</span>
          <select bind:value={sortMode} aria-label={t('sortLabel')}>
            {#each sortOptions as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      {:else}
        <span class="sort sort-fixed">{t('sortAddedFixed')}</span>
      {/if}
    </header>

    {#if isTriage}
      <div class="triage-banner" role="status">
        <span>📥 {t('triageMode')} — {t('triageHint')}</span>
        <span class="triage-keys">⌨ j/k · 1/2/3 · x · e · Space</span>
      </div>
    {/if}

    {#if view !== 'stats'}
      <QuickAdd bind:this={quickAddRef} onadd={addTask} onaddMany={(lines) => void addLines(lines)} />

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
          <span class="postpone-group" role="group" aria-label={t('postponeAria')}>
            <span class="postpone-label">{t('postponeLabel')}</span>
            <button
              class="bulk-postpone"
              onclick={() => void postponeSelected({ days: 1 })}
            >
              {t('postpone1d')}
            </button>
            <button
              class="bulk-postpone"
              onclick={() => void postponeSelected({ days: 7 })}
            >
              {t('postpone1w')}
            </button>
            <button
              class="bulk-postpone"
              onclick={() => void postponeSelected({ months: 1 })}
            >
              {t('postpone1m')}
            </button>
          </span>
          <input
            class="bulk-tag-input"
            type="text"
            placeholder={t('bulkTagPlaceholder')}
            aria-label={t('bulkAddTag')}
            bind:value={bulkTag}
          />
          <button class="bulk-postpone" onclick={() => void applyBulkTag(true)}>
            {t('bulkAddTag')}
          </button>
          <button class="bulk-postpone" onclick={() => void applyBulkTag(false)}>
            {t('bulkRemoveTag')}
          </button>
        {/if}
        <button class="bulk-cancel" onclick={clearSelection}>{t('clearSelection')}</button>
      </div>
    {/if}

    {#if view === 'trash'}
      <p class="trash-note">{t('trashNote')}</p>
    {/if}
    {/if}

    {#if view === 'stats'}
      <StatsView {tasks} />
    {:else if !loaded}
      <p class="empty">{t('loading')}</p>
    {:else if visibleTasks.length === 0}
      <p class="empty">
        {t('noTasks')}<br />
        {t('examplePrefix')} <code>{t('exampleTask')}</code>
      </p>
    {:else}
      <ul class="tasks">
        {#snippet taskRow(t: Task, isChild: boolean, isCursor: boolean)}
          <TaskRow
            task={t}
            listName={lists.find((l) => l.id === t.listId)?.name}
            activeTag={tagFilter}
            {mutedTags}
            selected={selectedIds.includes(t.id)}
            liveMinutes={tracking?.id === t.id ? tracking.minutes : undefined}
            searchQuery={searchQuery}
            triageLists={isTriage ? triageLists : undefined}
            child={isChild}
            cursor={isCursor}
            subtaskInfo={subtaskProgress.get(t.id)}
            ontoggle={(id, checked) =>
              (selectedIds = checked
                ? [...selectedIds, id]
                : selectedIds.filter((sid) => sid !== id))}
            onedit={(id) => (editingId = id)}
            ontag={(tag) => (tagFilter = tagFilter === tag ? null : tag)}
            onstartTimer={startTaskTimer}
            onstopTimer={stopTaskTimer}
            ontriage={moveTriage}
          />
        {/snippet}
        {#each renderedRows as entry, i (entry.task.id)}
          {@render taskRow(entry.task, entry.isChild, i === cursorIndex)}
        {/each}
      </ul>
      <p class="footer">
        {t('remaining', { n: remaining, total: filteredSorted.length })}
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
    subtasks={editingSubtasks}
    onsave={saveEdit}
    ondelete={softDeleteTask}
    onclose={() => (editingId = null)}
    onsplit={splitTask}
  />
{/if}
