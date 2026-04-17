/// <reference lib="webworker" />

import { processRow } from "@/lib/reference-normalizer/row-processor";
import type { NormalizerConfig, RowProcessInput } from "@/lib/reference-normalizer/types";

type WorkerRequest = {
  config: NormalizerConfig;
  rows: RowProcessInput[];
};

const ctx: DedicatedWorkerGlobalScope = self as never;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { config, rows } = event.data;
  const output = [];

  for (let index = 0; index < rows.length; index += 1) {
    output.push(processRow(rows[index], config));

    if ((index + 1) % 25 === 0 || index === rows.length - 1) {
      ctx.postMessage({
        type: "progress",
        completed: index + 1,
        total: rows.length,
      });
    }
  }

  ctx.postMessage({
    type: "done",
    rows: output,
  });
};

export {};
