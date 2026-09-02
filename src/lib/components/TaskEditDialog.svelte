<script module lang="ts">
  export interface TaskEdits {
    title: string;
    notes?: string;
    due?: string;
    dueTime?: string;
    priority?: 1 | 2 | 3;
    tags: string[];
    listId?: string;
    estimateMinutes?: number;
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
    onclose,
  }: {
    task: Task;
    lists: List[];
    onsave: (id: string, edits: TaskEdits) => void;
    onclose: () => void;
  } = $props();

  let dialogEl = $state<HTMLDialogElement>();
  // ダイアログを開いている間に裏でタスクが更新されても入力中の内容を壊さないよう、
  // task.id が変わったときだけフォームを初期化する
  let initializedFor = $state('');

  let title = $state('');
  let notes = $state('');
  let due = $state('');
  let dueTime = $state('');
  let priority = $state('');
  let tagsText = $state('');
  let listId = $state('');
  let estimateText = $state('');

  $effect(() => {
    if (initializedFor !== task.id) {
      initializedFor = task.id;
      title = task.title;
      notes = task.notes ?? '';
      due = task.due ?? '';
      dueTime = task.dueTime ?? '';
      priority = task.priority ? String(task.priority) : '';
      tagsText = task.tags.join(' ');
      listId = task.listId ?? '';
      estimateText = task.estimateMinutes
        ? formatDuration(task.estimateMinutes, i18n.locale)
        : '';
      dialogEl?.showModal();
    }
  });

  function close() {
    dialogEl?.close();
  }

  function save() {
    if (!title.trim()) return;
    onsave(task.id, {
      title: title.trim(),
      notes: notes.trim() || undefined,
      due: due || undefined,
      dueTime: dueTime || undefined,
      priority: priority ? (Number(priority) as 1 | 2 | 3) : undefined,
      tags: tagsText.split(/[\s,、，]+/).filter(Boolean),
      listId: listId || undefined,
      estimateMinutes: estimateText.trim() ? parseEstimateMinutes(estimateText) : undefined,
    });
    close();
  }
</script>

<dialog bind:this={dialogEl} class="dialog" aria-label={t('dialogAria')} onclose={onclose}>
  <form onsubmit={(e) => { e.preventDefault(); save(); }}>
    <h2>{t('editTask')}</h2>
    <label>
      {t('titleLabel')}
      <input type="text" bind:value={title} />
    </label>
    <label>
      {t('notesLabel')}
      <textarea bind:value={notes} rows="3"></textarea>
    </label>
    <div class="grid">
      <label>
        {t('dueLabel')}
        <input type="date" bind:value={due} />
      </label>
      <label>
        {t('dueTimeLabel')}
        <!-- 10 分刻みのピッカー（細かい値はキーボード入力で可） -->
        <input type="time" step="600" bind:value={dueTime} />
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
    </div>
    <label>
      {t('tagsLabel')}
      <input type="text" placeholder={t('tagsPlaceholder')} bind:value={tagsText} />
    </label>
    <div class="actions">
      <button type="button" onclick={close}>{t('cancel')}</button>
      <button type="submit" disabled={!title.trim()}>{t('save')}</button>
    </div>
  </form>
</dialog>
