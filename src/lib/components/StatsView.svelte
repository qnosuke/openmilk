<script lang="ts">
  import { i18n, t } from '../i18n.svelte';
  import type { Task } from '../db/schema';
  import { addDays, formatDuration, toISODate, todayISO } from '../utils/date';

  let { tasks }: { tasks: Task[] } = $props();

  interface StatsRow {
    key: string;
    done: number;
    estimate: number;
    tracked: number;
    /** 見積もり付きのうち実績が見積もり以内に収まった数 */
    onTime: number;
    withEst: number;
  }

  /** 日次（今日）・週次（直近7日）・月次・年次で完了タスクの見積もりと実績を集計 */
  const rows = $derived.by<StatsRow[]>(() => {
    const t0 = todayISO();
    const weekStart = addDays(t0, -6);
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearPrefix = String(now.getFullYear());
    const mk = (key: string): StatsRow => ({
      key,
      done: 0,
      estimate: 0,
      tracked: 0,
      onTime: 0,
      withEst: 0,
    });
    const buckets: Record<string, StatsRow> = {
      statsToday: mk('statsToday'),
      statsWeek: mk('statsWeek'),
      statsMonth: mk('statsMonth'),
      statsYear: mk('statsYear'),
    };
    for (const task of tasks) {
      if (task.deleted || task.completedAt === undefined) continue;
      const day = toISODate(new Date(task.completedAt));
      let keys: string[];
      if (day === t0) keys = ['statsToday', 'statsWeek', 'statsMonth', 'statsYear'];
      else if (day >= weekStart && day <= t0) keys = ['statsWeek', 'statsMonth', 'statsYear'];
      else if (day.startsWith(monthPrefix)) keys = ['statsMonth', 'statsYear'];
      else if (day.startsWith(yearPrefix)) keys = ['statsYear'];
      else continue;
      for (const key of keys) {
        const b = buckets[key];
        b.done += 1;
        b.estimate += task.estimateMinutes ?? 0;
        b.tracked += task.trackedMinutes ?? 0;
        if (task.estimateMinutes) {
          b.withEst += 1;
          if ((task.trackedMinutes ?? 0) <= task.estimateMinutes) b.onTime += 1;
        }
      }
    }
    return [buckets.statsToday, buckets.statsWeek, buckets.statsMonth, buckets.statsYear];
  });

  const hasData = $derived(rows.some((r) => r.done > 0));
</script>

<div class="stats">
  <p class="stats-hint">{t('statsHint')}</p>
  {#if !hasData}
    <p class="empty">{t('statsNoData')}</p>
  {:else}
    <table class="stats-table">
      <thead>
        <tr>
          <th scope="col"><span class="visually-hidden">period</span></th>
          <th scope="col">{t('viewCompleted')}</th>
          <th scope="col">{t('statsEst')}</th>
          <th scope="col">{t('statsTrackedCol')}</th>
          <th scope="col">{t('statsOnTime')}</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.key)}
          <tr>
            <th scope="row">{t(row.key)}</th>
            <td class="num">{row.done}</td>
            <td class="num">{row.estimate > 0 ? formatDuration(row.estimate, i18n.locale) : '—'}</td>
            <td class="num">{row.tracked > 0 ? formatDuration(row.tracked, i18n.locale) : '—'}</td>
            <td class="num">
              {row.withEst > 0 ? `${Math.round((row.onTime / row.withEst) * 100)}%` : '—'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
