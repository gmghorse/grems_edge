import { create } from "zustand";

export const POWER_WINDOW_MS = 30_000;

export type PowerSample = { timestamp: number; powerKw: number };

type PowerHistoryStore = {
  samples: PowerSample[];
  addSample: (sample: PowerSample) => void;
};

export const usePowerHistoryStore = create<PowerHistoryStore>((set) => ({
  samples: [],
  addSample: (sample) =>
    set((state) => ({
      samples: [
        ...state.samples.filter(
          (item) => sample.timestamp - item.timestamp < POWER_WINDOW_MS,
        ),
        sample,
      ],
    })),
}));
