import { afterEach, describe, expect, it, vi } from "vitest";
import {
  companionEmotion, COMPANION_EMOTION_DURATION_MS, getCompanionServerSnapshot,
  getCompanionSnapshot, publishCompanionAudio, publishCompanionEmotion, subscribeCompanion,
  companionExpression, COMPANION_VALIDATION_DURATION_MS, publishCompanionValidation, resetVoiceCompanion,
} from "./voice-companion";

afterEach(() => {
  resetVoiceCompanion();
  vi.useRealTimers();
});

describe("memory-only voice companion", () => {
  it.each([
    ["happy", "happy"], ["contento/a", "happy"], ["sad", "sad"], ["triste", "sad"],
    ["surprised", "surprised"], ["sorprendido/a", "surprised"], ["neutral", "idle"],
    ["angry", "concerned"], ["disgusted", "concerned"], ["fearful", "concerned"],
    ["enojado/a", "concerned"], ["disgustado/a", "concerned"], ["con miedo", "concerned"],
    ["other", null], ["unknown", null], ["sin datos suficientes", null], ["network", null],
    ["activado/a", null], ["apagado/a", null], [null, null], ["__proto__", null],
  ])("maps model label %s without inferring from local heuristics", (label, expected) => {
    expect(companionEmotion(label)).toBe(expected);
  });

  it("only follows normalized actual level while capture is active", () => {
    publishCompanionAudio(true, 0.41);
    expect(getCompanionSnapshot()).toMatchObject({ active: true, level: 0.42, emotion: null });
    publishCompanionAudio(true, 15);
    expect(getCompanionSnapshot().level).toBe(1);
    publishCompanionAudio(true, NaN);
    expect(getCompanionSnapshot().level).toBe(0);
    publishCompanionAudio(false, 1);
    expect(getCompanionSnapshot()).toMatchObject({ active: false, level: 0 });
  });

  it("does not invent an emotion from audio volume and clears the previous result for a new capture", () => {
    publishCompanionEmotion("happy");
    publishCompanionAudio(true, 1);
    expect(getCompanionSnapshot().emotion).toBeNull();
    publishCompanionAudio(false, 0);
    expect(getCompanionSnapshot().emotion).toBeNull();
    publishCompanionEmotion("sad");
    expect(getCompanionSnapshot().emotion).toBe("sad");
    publishCompanionEmotion("sin datos suficientes");
    expect(getCompanionSnapshot().emotion).toBeNull();
  });

  it("expires model reactions instead of portraying old audio as current feelings", () => {
    vi.useFakeTimers();
    publishCompanionEmotion("happy");
    vi.advanceTimersByTime(COMPANION_EMOTION_DURATION_MS - 1);
    expect(getCompanionSnapshot().emotion).toBe("happy");
    vi.advanceTimersByTime(1);
    expect(getCompanionSnapshot().emotion).toBeNull();
  });

  it("replaces old expiry timers and cancels one on recording start", () => {
    vi.useFakeTimers();
    publishCompanionEmotion("happy");
    vi.advanceTimersByTime(5000);
    publishCompanionEmotion("sad");
    vi.advanceTimersByTime(COMPANION_EMOTION_DURATION_MS - 5000);
    expect(getCompanionSnapshot().emotion).toBe("sad");
    publishCompanionAudio(true, 0.2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("has a stable SSR snapshot and stable identity until a meaningful signal changes", () => {
    const initial = getCompanionSnapshot();
    expect(getCompanionServerSnapshot()).toEqual({ active: false, level: 0, emotion: null, validation: null });
    publishCompanionAudio(false, 0);
    expect(getCompanionSnapshot()).toBe(initial);
    const listener = vi.fn();
    const unsubscribe = subscribeCompanion(listener);
    publishCompanionAudio(true, 0.2);
    publishCompanionAudio(true, 0.201);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    publishCompanionAudio(false, 0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("moves into the speaking pose from live amplitude without any ASR or emotion result", () => {
    publishCompanionAudio(true, 0);
    expect(companionExpression(getCompanionSnapshot())).toBe("idle");
    publishCompanionAudio(true, 0.4);
    expect(companionExpression(getCompanionSnapshot())).toBe("listening");
    expect(getCompanionSnapshot().emotion).toBeNull();
    publishCompanionAudio(true, 0);
    expect(companionExpression(getCompanionSnapshot())).toBe("idle");
  });

  it("keeps actual validation separate from audio emotion and gives it presentation priority", () => {
    publishCompanionEmotion("sad");
    expect(getCompanionSnapshot().validation).toBeNull();
    publishCompanionValidation("thinking");
    expect(companionExpression(getCompanionSnapshot())).toBe("thinking");
    publishCompanionValidation("success");
    expect(companionExpression(getCompanionSnapshot())).toBe("success");
    expect(getCompanionSnapshot().emotion).toBe("sad");
    publishCompanionValidation("retry");
    expect(companionExpression(getCompanionSnapshot())).toBe("retry");
    publishCompanionValidation(null);
    expect(companionExpression(getCompanionSnapshot())).toBe("sad");
  });

  it("expires actual validation and cancels every reaction on teardown", () => {
    vi.useFakeTimers();
    publishCompanionValidation("success");
    vi.advanceTimersByTime(COMPANION_VALIDATION_DURATION_MS);
    expect(getCompanionSnapshot().validation).toBeNull();
    publishCompanionValidation("thinking");
    vi.advanceTimersByTime(COMPANION_VALIDATION_DURATION_MS);
    expect(getCompanionSnapshot().validation).toBe("thinking");
    publishCompanionEmotion("happy");
    resetVoiceCompanion();
    expect(getCompanionSnapshot()).toEqual(getCompanionServerSnapshot());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears old grades on a fresh explicit audio session but preserves them when audio is paused", () => {
    publishCompanionValidation("success");
    publishCompanionAudio(false, 0);
    expect(getCompanionSnapshot().validation).toBe("success");
    publishCompanionAudio(true, 0.1);
    expect(getCompanionSnapshot().validation).toBeNull();
  });
});
