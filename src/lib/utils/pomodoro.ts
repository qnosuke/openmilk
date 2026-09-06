/**
 * ポモドーロタイマーの周期計算。
 * 計測タイマー（timerStartedAt からの経過）に重ねて使う:
 * 経過秒から「今は集中か休憩か・何周目か・残り秒」を求める純粋関数。
 */

export interface PomodoroSettings {
  /** 集中セッションの長さ（分） */
  workMinutes: number;
  /** 短い休憩（分） */
  breakMinutes: number;
  /** 長い休憩（分） */
  longBreakMinutes: number;
  /** 何周ごとに長い休憩を入れるか */
  longBreakEvery: number;
}

export const DEFAULT_POMODORO: PomodoroSettings = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
};

export type PomodoroPhaseName = 'focus' | 'break' | 'longBreak';

export interface PomodoroPhase {
  phase: PomodoroPhaseName;
  /** 集中セッションの何周目か（1始まり）。休憩中は直前に終えた周数 */
  session: number;
  /** 今のフェーズの残り秒（切り上げ） */
  remainingSeconds: number;
}

/** 経過秒から現在のフェーズを求める。settings の値は不正値でも丸めて使う */
export function pomodoroPhase(elapsedSeconds: number, s: PomodoroSettings): PomodoroPhase {
  const work = Math.max(1, Math.round(s.workMinutes)) * 60;
  const br = Math.max(1, Math.round(s.breakMinutes)) * 60;
  const long = Math.max(1, Math.round(s.longBreakMinutes)) * 60;
  const every = Math.max(1, Math.round(s.longBreakEvery));
  // 1周期で割っておくことで、経過が何日分でもループは every 周で終わる
  const cycle = every * work + (every - 1) * br + long;
  let pos = Math.max(0, elapsedSeconds) % cycle;
  let session = 0;
  for (;;) {
    if (pos < work) return { phase: 'focus', session: session + 1, remainingSeconds: Math.ceil(work - pos) };
    pos -= work;
    session += 1;
    const isLong = session % every === 0;
    const breakDur = isLong ? long : br;
    if (pos < breakDur) {
      return { phase: isLong ? 'longBreak' : 'break', session, remainingSeconds: Math.ceil(breakDur - pos) };
    }
    pos -= breakDur;
  }
}

/** 残り秒を m:ss 形式にする（例: 65 → '1:05'） */
export function formatPomodoroClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const r = total % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
