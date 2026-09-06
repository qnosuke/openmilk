import { describe, it, expect } from 'vitest';
import { pomodoroPhase, formatPomodoroClock, DEFAULT_POMODORO } from './pomodoro';

const S = DEFAULT_POMODORO; // 25分集中 / 5分休憩 / 15分長休憩 / 4周ごと

describe('pomodoroPhase', () => {
  it('開始直後は1周目の集中', () => {
    expect(pomodoroPhase(0, S)).toEqual({ phase: 'focus', session: 1, remainingSeconds: 25 * 60 });
  });

  it('集中終了の1秒前と直後', () => {
    expect(pomodoroPhase(25 * 60 - 1, S)).toEqual({
      phase: 'focus',
      session: 1,
      remainingSeconds: 1,
    });
    expect(pomodoroPhase(25 * 60, S)).toEqual({
      phase: 'break',
      session: 1,
      remainingSeconds: 5 * 60,
    });
  });

  it('休憩の後は2周目の集中', () => {
    expect(pomodoroPhase((25 + 5) * 60, S)).toEqual({
      phase: 'focus',
      session: 2,
      remainingSeconds: 25 * 60,
    });
  });

  it('4周目の後は長い休憩', () => {
    const pos = (4 * 25 + 3 * 5) * 60; // 4回の集中と3回の短い休憩が終わった時点
    expect(pomodoroPhase(pos, S)).toEqual({
      phase: 'longBreak',
      session: 4,
      remainingSeconds: 15 * 60,
    });
  });

  it('長い休憩の後は周期がリスタートする（1周目に戻る）', () => {
    const cycle = (4 * 25 + 3 * 5 + 15) * 60;
    expect(pomodoroPhase(cycle, S)).toEqual({
      phase: 'focus',
      session: 1,
      remainingSeconds: 25 * 60,
    });
  });

  it('非常に長い経過（周期の整数倍を超える）でも破綻しない', () => {
    const cycle = (4 * 25 + 3 * 5 + 15) * 60;
    expect(pomodoroPhase(cycle * 1234 + 10, S)).toEqual({
      phase: 'focus',
      session: 1,
      remainingSeconds: 25 * 60 - 10,
    });
  });

  it('不正な設定値は丸められる', () => {
    const p = pomodoroPhase(0, { workMinutes: 0, breakMinutes: -5, longBreakMinutes: 0, longBreakEvery: 0 });
    expect(p).toEqual({ phase: 'focus', session: 1, remainingSeconds: 60 });
  });
});

describe('formatPomodoroClock', () => {
  it('m:ss 形式にする', () => {
    expect(formatPomodoroClock(0)).toBe('0:00');
    expect(formatPomodoroClock(65)).toBe('1:05');
    expect(formatPomodoroClock(600)).toBe('10:00');
  });
});
