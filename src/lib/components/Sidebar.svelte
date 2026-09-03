<script module lang="ts">
  /** タグなし絞り込みのセンチネル値（tagFilter に渡す） */
  export const UNTAGGED = '__untagged__';
</script>

<script lang="ts">
  import { LOCALE_NAMES, i18n, locales, setLocale, t, type Locale } from '../i18n.svelte';
  import type { List } from '../db/schema';

  let {
    lists,
    selected,
    counts,
    rangeCounts,
    tagCounts,
    mutedTags,
    untaggedCount,
    activeTag,
    dueFilter,
    dataStatus,
    completedCount,
    search,
    onsearch,
    onselect,
    oncreate,
    ondelete,
    onexport,
    onimportFile,
    onsetDueFilter,
    onselectTag,
    ontoggleMute,
    onDeleteCompleted,
  }: {
    lists: List[];
    selected: string;
    counts: Record<string, number>;
    /** 今日/明日/1週間/期限切れの未完了件数 */
    rangeCounts: { overdue: number; today: number; tomorrow: number; week: number };
    /** 未完了タスクのタグ出現数（多い順、ミュート状態つき） */
    tagCounts: { name: string; count: number; muted: boolean }[];
    mutedTags: string[];
    untaggedCount: number;
    activeTag: string | null;
    dueFilter: 'overdue' | 'today' | 'tomorrow' | 'week' | null;
    dataStatus: string;
    completedCount: number;
    search: string;
    onselect: (id: string) => void;
    oncreate: (name: string) => void;
    ondelete: (id: string) => void;
    onexport: () => void;
    onimportFile: (file: File) => void;
    onsearch: (query: string) => void;
    /** 同じボタンを押すと解除される（null が渡る） */
    onsetDueFilter: (filter: 'overdue' | 'today' | 'tomorrow' | 'week' | null) => void;
    /** タグクリックで絞り込みトグル（ミュート中タグならミュート解除） */
    onselectTag: (tag: string) => void;
    ontoggleMute: (tag: string) => void;
    onDeleteCompleted: () => void;
  } = $props();

  let fileInput = $state<HTMLInputElement>();
  let detailsEl = $state<HTMLDetailsElement>();
  let name = $state('');
  let confirmWipe = $state(false);
  let wipeTimer: number | undefined;

  function submit(event?: SubmitEvent) {
    event?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    oncreate(trimmed);
    name = '';
  }

  // webview・自動化環境ではフォームの暗黙的 submit が働かないため Enter を明示処理する
  function handleKeydown(event: KeyboardEvent) {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  // 完了タスクの一括削除は2段階確認（4秒で戻る）
  function wipeClicked() {
    if (!confirmWipe) {
      confirmWipe = true;
      window.setTimeout(() => (confirmWipe = false), 4000);
      return;
    }
    window.clearTimeout(wipeTimer);
    confirmWipe = false;
    onDeleteCompleted();
  }

  // ウィンドウの外をクリックしたら設定を閉じる
  $effect(() => {
    function onDocClick(event: MouseEvent) {
      if (detailsEl?.open && !detailsEl.contains(event.target as Node)) {
        detailsEl.open = false;
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  });

  const filters = $derived([
    { value: 'overdue', label: t('filterOverdue'), count: rangeCounts.overdue },
    { value: 'today', label: t('filterToday'), count: rangeCounts.today },
    { value: 'tomorrow', label: t('filterTomorrow'), count: rangeCounts.tomorrow },
    { value: 'week', label: t('filterWeek'), count: rangeCounts.week },
  ] as const);
</script>

<aside class="sidebar">
  <h1 class="logo">🥛 openmilk</h1>

  <nav aria-label={t('navAria')}>
    <button class="nav-btn" class:active={selected === 'all'} onclick={() => onselect('all')}>
      <span class="nav-label">{t('allLists')}</span>
      <span class="count">{counts.all ?? 0}</span>
    </button>
    <button class="nav-btn inbox" class:active={selected === 'inbox'} onclick={() => onselect('inbox')}>
      <span class="nav-label">{t('inbox')}</span>
      <span class="count">{counts.inbox ?? 0}</span>
    </button>
    {#each lists as list (list.id)}
      <div class="nav-item">
        <button class="nav-btn" class:active={selected === list.id} onclick={() => onselect(list.id)}>
          <span class="nav-label">{list.name}</span>
          <span class="count">{counts[list.id] ?? 0}</span>
        </button>
        {#if !list.fixed}
          <button
            class="nav-delete"
            aria-label={t('ariaDeleteList', { name: list.name })}
            title={t('deleteListHint')}
            onclick={() => ondelete(list.id)}>×</button
          >
        {/if}
      </div>
    {/each}
  </nav>

  <div class="due-filter" role="group" aria-label={t('filterAria')}>
    {#each filters as filter (filter.value)}
      <button
        class="filter-btn"
        class:active={dueFilter === filter.value}
        onclick={() => onsetDueFilter(dueFilter === filter.value ? null : filter.value)}
      >
        <span class="num">{filter.count}</span>
        <span class="lbl">{filter.label}</span>
      </button>
    {/each}
  </div>

  {#if tagCounts.length > 0}
    <div class="tag-cloud" role="group" aria-label={t('tagsLabel')}>
      <div class="section-label">{t('tagsLabel')}</div>
      <div class="tag-cloud-chips">
        {#each tagCounts.filter((t) => !t.muted) as tag (tag.name)}
          <button
            class="tag-chip"
            class:active={activeTag === tag.name}
            onclick={() => onselectTag(tag.name)}
          >
            #{tag.name}<span class="tag-count">{tag.count}</span>
          </button>
        {/each}
        {#if untaggedCount > 0 || activeTag === UNTAGGED}
          <button
            class="tag-chip"
            class:active={activeTag === UNTAGGED}
            onclick={() => onselectTag(UNTAGGED)}
          >
            {t('untagged')}<span class="tag-count">{untaggedCount}</span>
          </button>
        {/if}
      </div>
      {#if mutedTags.length > 0}
        <div class="muted-note">
          <span class="section-label">{t('hiddenTagsLabel')}</span>
          {#each mutedTags as tag (tag)}
            <button
              class="tag-chip muted"
              title={t('muteTag', { tag })}
              onclick={() => onselectTag(tag)}>#{tag}</button
            >
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <input
    class="search"
    type="search"
    placeholder={t('searchPlaceholder')}
    aria-label={t('search')}
    value={search}
    oninput={(e) => onsearch(e.currentTarget.value)}
  />

  <!-- 書き出し・読み込み・言語は常用しないため折りたたみに格納。
       ドット絵アイコンをクリックすると右にピクセル風ウィンドウが出る -->
  <details class="settings" bind:this={detailsEl}>
    <summary aria-label={t('settings')} title={t('settings')}>
      <img class="milk-icon" src="/milk-pixel.png" alt={t('settings')} />
    </summary>
    <div class="settings-body">
      <form class="new-list" onsubmit={(e) => submit(e)}>
        <input
          type="text"
          placeholder={t('newListPlaceholder')}
          aria-label={t('newListPlaceholder')}
          bind:value={name}
          onkeydown={handleKeydown}
        />
        <button type="submit" disabled={!name.trim()}>{t('create')}</button>
      </form>
      <div class="data-actions">
        <button type="button" onclick={onexport}>{t('exportLabel')}</button>
        <button type="button" onclick={() => fileInput?.click()}>{t('importLabel')}</button>
        <input
          type="file"
          accept="application/json,.json"
          bind:this={fileInput}
          onchange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) onimportFile(file);
            e.currentTarget.value = '';
          }}
        />
      </div>
      {#if dataStatus}
        <p class="data-status" role="status">{dataStatus}</p>
      {/if}
      {#if tagCounts.length > 0}
        <div class="hidden-tags">
          <div class="section-label">{t('hiddenTagsLabel')}</div>
          <div class="tag-cloud-chips">
            {#each tagCounts as tag (tag.name)}
              <button
                class="tag-chip"
                class:muted={tag.muted}
                onclick={() => ontoggleMute(tag.name)}
              >
                {tag.muted ? '⊘' : ''}#{tag.name}<span class="tag-count">{tag.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
      <button class="wipe" disabled={completedCount === 0 && !confirmWipe} onclick={wipeClicked}>
        {confirmWipe ? t('confirmDeleteN', { n: completedCount }) : `${t('deleteCompleted')} (${completedCount})`}
      </button>
      <label class="lang">
        <span>{t('language')}</span>
        <select
          value={i18n.locale}
          onchange={(e) => setLocale(e.currentTarget.value as Locale)}
          aria-label={t('language')}
        >
          {#each locales as l (l)}
            <option value={l}>{LOCALE_NAMES[l]}</option>
          {/each}
        </select>
      </label>
    </div>
  </details>
</aside>
