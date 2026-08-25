interface PendingTask {
  task: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export interface AsyncTaskPool {
  add(task: () => Promise<void>): Promise<void>;
}

/** Runs queued work with a fixed concurrency ceiling. */
export function createAsyncTaskPool(concurrency: number): AsyncTaskPool {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Task-pool concurrency must be a positive integer.");
  }

  const pending: PendingTask[] = [];
  let active = 0;

  function drain() {
    while (active < concurrency && pending.length > 0) {
      const next = pending.shift();
      if (!next) return;
      active += 1;
      void Promise.resolve().then(next.task).then(next.resolve, next.reject).finally(() => {
        active -= 1;
        drain();
      });
    }
  }

  return {
    add(task) {
      return new Promise<void>((resolve, reject) => {
        pending.push({ task, resolve, reject });
        drain();
      });
    },
  };
}
