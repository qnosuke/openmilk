<script lang="ts">
  import { LOCALE_NAMES, i18n, locales, setLocale, t, type Locale } from '../i18n.svelte';
  import type { List } from '../db/schema';

  let {
    lists,
    selected,
    counts,
    dataStatus,
    onselect,
    oncreate,
    ondelete,
    onexport,
    onimportFile,
  }: {
    lists: List[];
    selected: string;
    counts: Record<string, number>;
    dataStatus: string;
    onselect: (id: string) => void;
    oncreate: (name: string) => void;
    ondelete: (id: string) => void;
    onexport: () => void;
    onimportFile: (file: File) => void;
  } = $props();

  let name = $state('');
  let fileInput = $state<HTMLInputElement>();

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
        <button
          class="nav-delete"
          aria-label={t('ariaDeleteList', { name: list.name })}
          title={t('deleteListHint')}
          onclick={() => ondelete(list.id)}>×</button
        >
      </div>
    {/each}
  </nav>

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
</aside>
