import { afterEach, describe, expect, it, vi } from "vitest";
import { GetStatusRefreshCoordinator, hasRefreshConfigurationChanged, refreshSettingsTransition } from "../src/actions/get-status-refresh-coordinator.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("Get Status refresh lifecycle", () => {
  it("runs a scheduled refresh only after the configured delay", () => {
    vi.useFakeTimers();
    const coordinator = new GetStatusRefreshCoordinator<void>();
    const callback = vi.fn();
    const generation = coordinator.nextGeneration("A");

    coordinator.schedule("A", 60_000, generation, callback);
    vi.advanceTimersByTime(59_999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("replaces the previous timer when the schedule is reset", () => {
    vi.useFakeTimers();
    const coordinator = new GetStatusRefreshCoordinator<void>();
    const first = vi.fn();
    const second = vi.fn();
    const generation = coordinator.nextGeneration("A");

    coordinator.schedule("A", 60_000, generation, first);
    coordinator.schedule("A", 120_000, generation, second);
    vi.advanceTimersByTime(120_000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not execute a stale generation after settings change or disappearance", () => {
    vi.useFakeTimers();
    const coordinator = new GetStatusRefreshCoordinator<void>();
    const callback = vi.fn();
    const oldGeneration = coordinator.nextGeneration("A");

    coordinator.schedule("A", 60_000, oldGeneration, callback);
    coordinator.nextGeneration("A");
    vi.advanceTimersByTime(60_000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("shares an in-flight request only for the same action and device", async () => {
    const coordinator = new GetStatusRefreshCoordinator<string>();
    let resolveA!: (value: string) => void;
    const requestA = new Promise<string>(resolve => { resolveA = resolve; });
    const startA = vi.fn(() => requestA);
    const startDuplicate = vi.fn(() => Promise.resolve("duplicate"));

    const first = coordinator.getOrStart("key", "device-a", startA);
    const duplicate = coordinator.getOrStart("key", "device-a", startDuplicate);

    expect(duplicate).toBe(first);
    expect(startDuplicate).not.toHaveBeenCalled();
    resolveA("A");
    await first;
  });

  it("starts a new request when the device changes while the old request is in flight", async () => {
    const coordinator = new GetStatusRefreshCoordinator<string>();
    let resolveA!: (value: string) => void;
    const requestA = new Promise<string>(resolve => { resolveA = resolve; });
    const startA = vi.fn(() => requestA);
    const startB = vi.fn(() => Promise.resolve("B"));

    const first = coordinator.getOrStart("key", "device-a", startA);
    const second = coordinator.getOrStart("key", "device-b", startB);

    expect(second).not.toBe(first);
    expect(startB).toHaveBeenCalledTimes(1);
    expect(await second).toBe("B");
    resolveA("A");
    await first;
  });
});


describe("Get Status refresh configuration", () => {
  const base = {
    deviceId: "device-a",
    output: { showStatusOnKey: true, refreshIntervalMinutes: 5 }
  };

  it("restarts polling for device, enabled-state, or interval changes", () => {
    expect(hasRefreshConfigurationChanged(base, { ...base, deviceId: "device-b" })).toBe(true);
    expect(hasRefreshConfigurationChanged(base, { ...base, output: { ...base.output, showStatusOnKey: false } })).toBe(true);
    expect(hasRefreshConfigurationChanged(base, { ...base, output: { ...base.output, refreshIntervalMinutes: 10 } })).toBe(true);
  });


  it("waits for the newly selected interval instead of refreshing immediately", () => {
    expect(refreshSettingsTransition(base, {
      ...base,
      output: { ...base.output, refreshIntervalMinutes: 10 }
    })).toBe("schedule");
  });

  it("restores the normal key immediately when switching to manual-only", () => {
    expect(refreshSettingsTransition(base, {
      ...base,
      output: { ...base.output, refreshIntervalMinutes: 0 }
    })).toBe("restore");
  });

  it("refreshes immediately when the device changes or status display is enabled", () => {
    expect(refreshSettingsTransition(base, { ...base, deviceId: "device-b" })).toBe("refresh-now");
    expect(refreshSettingsTransition({
      ...base,
      output: { ...base.output, showStatusOnKey: false }
    }, base)).toBe("refresh-now");
  });

  it("does not restart polling when refresh-relevant settings are unchanged", () => {
    expect(hasRefreshConfigurationChanged(base, {
      deviceId: " device-a ",
      output: { showStatusOnKey: true, refreshIntervalMinutes: 5 }
    })).toBe(false);
  });
});
