<script lang="ts">
  import { LOCALE_NAMES, i18n, locales, setLocale, t, type Locale } from '../i18n.svelte';
  import type { List } from '../db/schema';

  let {
    lists,
    selected,
    counts,
    rangeCounts,
    tagCounts,
    activeTag,
    dueFilter,
    dataStatus,
    search,
    onsearch,
    onselect,
    ondelete,
    onexport,
    onimportFile,
    onsetDueFilter,
    onselectTag,
  }: {
    lists: List[];
    selected: string;
    counts: Record<string, number>;
    /** 今日/明日/1週間/期限切れの未完了件数 */
    rangeCounts: { overdue: number; today: number; tomorrow: number; week: number };
    /** 未完了タスクのタグ出現数（多い順） */
    tagCounts: { name: string; count: number }[];
    activeTag: string | null;
    dueFilter: 'overdue' | 'today' | 'tomorrow' | 'week' | null;
    dataStatus: string;
    search: string;
    onselect: (id: string) => void;
    ondelete: (id: string) => void;
    onexport: () => void;
    onimportFile: (file: File) => void;
    onsearch: (query: string) => void;
    /** 同じボタンを押すと解除される（null が渡る） */
    onsetDueFilter: (filter: 'overdue' | 'today' | 'tomorrow' | 'week' | null) => void;
    /** タグクリックで絞り込みトグル */
    onselectTag: (tag: string) => void;
  } = $props();

  let fileInput = $state<HTMLInputElement>();
  let detailsEl = $state<HTMLDetailsElement>();

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
        {#each tagCounts as tag (tag.name)}
          <button
            class="tag-chip"
            class:active={activeTag === tag.name}
            onclick={() => onselectTag(tag.name)}
          >
            #{tag.name}<span class="tag-count">{tag.count}</span>
          </button>
        {/each}
      </div>
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
