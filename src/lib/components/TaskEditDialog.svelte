<script module lang="ts">
  export interface TaskEdits {
    title: string;
    notes?: string;
    due?: string;
    dueTime?: string;
    remindMinutesBefore?: number;
    priority?: 1 | 2 | 3;
    tags: string[];
    listId?: string;
    estimateMinutes?: number;
    trackedMinutes?: number;
  }
</script>

<script lang="ts">
  import { i18n, t } from '../i18n.svelte';
  import type { List, Task } from '../db/schema';
  import { formatDuration } from '../utils/date';
  import { parseEstimateMinutes } from '../utils/parseTask';

  let {
    task,
    lists,
    onsave,
    ondelete,
    onclose,
  }: {
    task: Task;
    lists: List[];
    onsave: (id: string, edits: TaskEdits) => void;
    ondelete: (id: string) => void;
    onclose: () => void;
  } = $props();

  let dialogEl = $state<HTMLDialogElement>();
  let notesEl = $state<HTMLTextAreaElement>();
  // ダイアログを開いている間に裏でタスクが更新されても入力中の内容を壊さないよう、
  // task.id が変わったときだけフォームを初期化する
  let initializedFor = $state('');

  let title = $state('');
  let notes = $state('');
  let due = $state('');
  let dueTime = $state('');
  let remind = $state('');
  let priority = $state('');
  let tagsText = $state('');
  let listId = $state('');
  let estimateText = $state('');
  let trackedText = $state('');

  // メモ欄を内容に合わせて伸縮させる（上限付きでそれ以上は内部スクロール）。
  // 収まっている間はスクロールバーを出さない
  function fitNotes() {
    if (!notesEl) return;
    notesEl.style.overflowY = 'hidden';
    notesEl.style.height = 'auto';
    const needed = notesEl.scrollHeight;
    const max = 320;
    notesEl.style.height = `${Math.min(needed, max)}px`;
    notesEl.style.overflowY = needed > max ? 'auto' : 'hidden';
  }

  $effect(() => {
    if (initializedFor !== task.id) {
      initializedFor = task.id;
      title = task.title;
      notes = task.notes ?? '';
      due = task.due ?? '';
      dueTime = task.dueTime ?? '';
      remind = task.remindMinutesBefore ? String(task.remindMinutesBefore) : '';
      priority = task.priority ? String(task.priority) : '';
      tagsText = task.tags.join(' ');
      listId = task.listId ?? '';
      estimateText = task.estimateMinutes
        ? formatDuration(task.estimateMinutes, i18n.locale)
        : '';
      trackedText = task.trackedMinutes
        ? formatDuration(task.trackedMinutes, i18n.locale)
        : '';
      dialogEl?.showModal();
      queueMicrotask(() => fitNotes());
    }
  });

  function close() {
    dialogEl?.close();
  }

  // リマインダーを初めて設定するときに通知権限を要求する
  function onRemindChange(value: string) {
    remind = value;
    if (value && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  function deleteTask() {
    ondelete(task.id);
    close();
  }

  function save() {
    if (!title.trim()) return;
    onsave(task.id, {
      title: title.trim(),
      notes: notes.trim() || undefined,
      due: due || undefined,
      dueTime: dueTime || undefined,
      remindMinutesBefore: remind ? Number(remind) : undefined,
      priority: priority ? (Number(priority) as 1 | 2 | 3) : undefined,
      tags: tagsText.split(/[\s,、，]+/).filter(Boolean),
      listId: listId || undefined,
      estimateMinutes: estimateText.trim() ? parseEstimateMinutes(estimateText) : undefined,
      trackedMinutes: trackedText.trim() ? parseEstimateMinutes(trackedText) : undefined,
    });
    close();
  }
</script>

<dialog
  bind:this={dialogEl}
  class="dialog"
  aria-label={t('dialogAria')}
  onclose={onclose}
  onclick={(e) => {
    // 背景クリック（ダイアログ自体がクリック元）でも保存する
    if (e.target === dialogEl) save();
  }}
>
  <!-- novalidate: 時刻の手入力（5分刻み以外）も保存できるようにする -->
  <form novalidate onsubmit={(e) => { e.preventDefault(); save(); }}>
    <h2>{t('editTask')}</h2>
    <label>
      {t('titleLabel')}
      <input type="text" bind:value={title} />
    </label>
    <label>
      {t('notesLabel')}
      <textarea bind:value={notes} bind:this={notesEl} oninput={fitNotes}></textarea>
    </label>
    <div class="grid">
      <label>
        {t('dueLabel')}
        <input type="date" bind:value={due} />
      </label>
      <label>
        {t('dueTimeLabel')}
        <!-- 10 分刻みのピッカー（細かい値はキーボード入力で可） -->
        <input type="time" step="300" bind:value={dueTime} />
      </label>
      <label>
        {t('remindLabel')}
        <select value={remind} onchange={(e) => onRemindChange(e.currentTarget.value)}>
          <option value="">{t('noneLabel')}</option>
          <option value="5">{t('remind5m')}</option>
          <option value="15">{t('remind15m')}</option>
          <option value="30">{t('remind30m')}</option>
          <option value="60">{t('remind1h')}</option>
          <option value="1440">{t('remind1d')}</option>
        </select>
      </label>
      <label>
        {t('priorityLabel')}
        <select bind:value={priority}>
          <option value="">{t('noneLabel')}</option>
          <option value="1">{t('p1')}</option>
          <option value="2">{t('p2')}</option>
          <option value="3">{t('p3')}</option>
        </select>
      </label>
      <label>
        {t('listLabel')}
        <select bind:value={listId}>
          <option value="">{t('inbox')}</option>
          {#each lists as list (list.id)}
            <option value={list.id}>{list.name}</option>
          {/each}
        </select>
      </label>
      <label>
        {t('estimateLabel')}
        <input type="text" placeholder={t('estimatePlaceholder')} bind:value={estimateText} />
      </label>
      <label>
        {t('trackedLabel')}
        <input type="text" placeholder={t('estimatePlaceholder')} bind:value={trackedText} />
      </label>
    </div>
    <label>
      {t('tagsLabel')}
      <input type="text" placeholder={t('tagsPlaceholder')} bind:value={tagsText} />
    </label>
    <div class="actions">
      <!-- 破壊的操作は左端のグレーに（誤タップ防止） -->
      <button type="button" class="delete-left" onclick={deleteTask}>{t('deleteLabel')}</button>
      <span class="spacer"></span>
      <button type="button" onclick={close}>{t('cancel')}</button>
      <button type="submit" disabled={!title.trim()}>{t('save')}</button>
    </div>
  </form>
</dialog>
