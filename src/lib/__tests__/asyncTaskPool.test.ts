import { describe, expect, it, vi } from "vitest";
import { createAsyncTaskPool } from "../asyncTaskPool";

describe("createAsyncTaskPool", () => {
  it("never exceeds its concurrency ceiling and keeps draining after a failure", async () => {
    const pool = createAsyncTaskPool(2);
    let active = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const started: number[] = [];

    const tasks = [0, 1, 2, 3].map((index) => pool.add(async () => {
      started.push(index);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      if (index === 1) throw new Error("expected failure");
    }));
    const resultsPromise = Promise.allSettled(tasks);

    await vi.waitFor(() => expect(started).toHaveLength(2));
    const firstWave = releases.splice(0, 2);
    firstWave.forEach((release) => release());
    await vi.waitFor(() => expect(started).toHaveLength(4));
    expect(active).toBe(2);
    const secondWave = releases.splice(0, 2);
    secondWave.forEach((release) => release());

    const results = await resultsPromise;
    expect(peak).toBe(2);
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
    ]);
  });

  it("rejects invalid concurrency values", () => {
    expect(() => createAsyncTaskPool(0)).toThrow(/positive integer/i);
  });
});
