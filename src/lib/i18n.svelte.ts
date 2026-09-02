export const locales = ['ja', 'en', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '中文',
};

type Dict = Record<string, string>;

const dicts: Record<Locale, Dict> = {
  ja: {
    allLists: 'すべて',
    inbox: 'INBOX',
    navAria: 'リスト切替',
    newListPlaceholder: '新しいリスト',
    create: '作成',
    language: '言語',
    sortLabel: '並び順',
    sortDue: '期限順',
    sortPriority: '優先度順',
    sortCreated: '追加順',
    addPlaceholder: 'タスクを追加（例: 明日レポート提出 30分 !2 #仕事）',
    add: '追加',
    prevDue: '期限',
    prevPriority: '優先度',
    prevTags: 'タグ',
    prevEstimate: '見積もり',
    loading: '読み込み中…',
    noTasks: 'タスクはありません。',
    examplePrefix: '例:',
    exampleTask: '明日レポート提出 30分 !2 #仕事',
    remaining: '残り {n} 件 / 全 {total} 件',
    todayTotal: '今日の作業予定 約{duration}',
    titleLabel: 'タイトル',
    notesLabel: 'メモ',
    dueLabel: '期限',
    dueTimeLabel: '時刻',
    priorityLabel: '優先度',
    noneLabel: 'なし',
    p1: '!1（高）',
    p2: '!2',
    p3: '!3',
    listLabel: 'リスト',
    estimateLabel: '見積もり',
    estimatePlaceholder: '例: 1時間30分',
    tagsLabel: 'タグ',
    tagsPlaceholder: 'スペース区切り',
    cancel: 'キャンセル',
    save: '保存',
    editTask: 'タスクを編集',
    dialogAria: 'タスクを編集',
    ariaComplete: '「{title}」を完了にする',
    ariaReopen: '「{title}」を未完了に戻す',
    ariaDelete: '「{title}」を削除',
    ariaEdit: '「{title}」の詳細を編集',
    ariaDeleteList: 'リスト「{name}」を削除',
    deleteListHint: 'リストを削除（タスクは INBOX に戻ります）',
    exportLabel: '書き出し',
    importLabel: '読み込み',
    dataExported: '書き出しました',
    importDone: '{n} 件を取り込みました',
    importInvalid: 'JSON を読み取れませんでした',
    settings: '設定',
    filterAria: '期間で絞り込み',
    filterToday: '今日',
    filterTomorrow: '明日',
    filterWeek: '1週間',
  },
  en: {
    allLists: 'All',
    inbox: 'INBOX',
    navAria: 'Lists',
    newListPlaceholder: 'New list',
    create: 'Add',
    language: 'Language',
    sortLabel: 'Sort',
    sortDue: 'By due date',
    sortPriority: 'By priority',
    sortCreated: 'Newest first',
    addPlaceholder: 'Add a task (e.g. report tomorrow 30m !2 #work)',
    add: 'Add',
    prevDue: 'Due',
    prevPriority: 'Priority',
    prevTags: 'Tags',
    prevEstimate: 'Est.',
    loading: 'Loading…',
    noTasks: 'No tasks yet.',
    examplePrefix: 'e.g.',
    exampleTask: 'report tomorrow 30m !2 #work',
    remaining: '{n} remaining / {total} total',
    todayTotal: 'Today: ~{duration}',
    titleLabel: 'Title',
    notesLabel: 'Notes',
    dueLabel: 'Due date',
    dueTimeLabel: 'Time',
    priorityLabel: 'Priority',
    noneLabel: 'None',
    p1: '!1 (High)',
    p2: '!2',
    p3: '!3',
    listLabel: 'List',
    estimateLabel: 'Estimate',
    estimatePlaceholder: 'e.g. 1h 30m',
    tagsLabel: 'Tags',
    tagsPlaceholder: 'space separated',
    cancel: 'Cancel',
    save: 'Save',
    editTask: 'Edit task',
    dialogAria: 'Edit task',
    ariaComplete: 'Complete "{title}"',
    ariaReopen: 'Reopen "{title}"',
    ariaDelete: 'Delete "{title}"',
    ariaEdit: 'Edit "{title}"',
    ariaDeleteList: 'Delete list "{name}"',
    deleteListHint: 'Delete list (tasks move back to INBOX)',
    exportLabel: 'Export',
    importLabel: 'Import',
    dataExported: 'Exported',
    importDone: 'Imported {n} tasks',
    importInvalid: 'Could not read that file',
    settings: 'Settings',
    filterAria: 'Filter by date',
    filterToday: 'Today',
    filterTomorrow: 'Tomorrow',
    filterWeek: '1 week',
  },
  zh: {
    allLists: '全部',
    inbox: 'INBOX',
    navAria: '列表切换',
    newListPlaceholder: '新建列表',
    create: '创建',
    language: '语言',
    sortLabel: '排序',
    sortDue: '按截止日期',
    sortPriority: '按优先级',
    sortCreated: '最新添加',
    addPlaceholder: '添加任务（例：明天交报告 30分钟 !2 #工作）',
    add: '添加',
    prevDue: '截止',
    prevPriority: '优先级',
    prevTags: '标签',
    prevEstimate: '预估',
    loading: '读取中…',
    noTasks: '还没有任务。',
    examplePrefix: '例：',
    exampleTask: '明天交报告 30分钟 !2 #工作',
    remaining: '剩余 {n} 件 / 共 {total} 件',
    todayTotal: '今天预计 约{duration}',
    titleLabel: '标题',
    notesLabel: '备注',
    dueLabel: '截止日期',
    dueTimeLabel: '时间',
    priorityLabel: '优先级',
    noneLabel: '无',
    p1: '!1（高）',
    p2: '!2',
    p3: '!3',
    listLabel: '列表',
    estimateLabel: '预估',
    estimatePlaceholder: '例：1小时30分',
    tagsLabel: '标签',
    tagsPlaceholder: '空格分隔',
    cancel: '取消',
    save: '保存',
    editTask: '编辑任务',
    dialogAria: '编辑任务',
    ariaComplete: '完成「{title}」',
    ariaReopen: '将「{title}」改回未完成',
    ariaDelete: '删除「{title}」',
    ariaEdit: '编辑「{title}」的详细内容',
    ariaDeleteList: '删除列表「{name}」',
    deleteListHint: '删除列表（任务将回到 INBOX）',
    exportLabel: '导出',
    importLabel: '导入',
    dataExported: '已导出',
    importDone: '已导入 {n} 条任务',
    importInvalid: '无法读取该文件',
    settings: '设置',
    filterAria: '按日期筛选',
    filterToday: '今天',
    filterTomorrow: '明天',
    filterWeek: '一周',
  },
};

const STORAGE_KEY = 'openmilk.locale';

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (locales as readonly string[]).includes(saved)) return saved as Locale;
  } catch {
    // localStorage が使えない環境ではブラウザ設定へ
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'ja';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

/** UI の表示言語。テンプレートから読むと locales 変更時に自動で再描画される */
export const i18n = $state({ locale: initialLocale() });

export function setLocale(locale: Locale): void {
  i18n.locale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 保存できなくても表示は切り替わる
  }
}

/** 辞書を引く。{name} 形式のプレースホルダを params で置換する */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = dicts[i18n.locale][key] ?? dicts.ja[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}
