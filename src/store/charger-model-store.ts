import { create } from "zustand";

type ChargerModelStore = {
  models: string[];
  addModel: (model: string) => void;
};

export const useChargerModelStore = create<ChargerModelStore>((set) => ({
  models: ["GREMS AC", "GREMS DC · 60 kW"],
  addModel: (model) => set((state) => state.models.some((item) => item.toLowerCase() === model.trim().toLowerCase())
    ? state
    : { models: [...state.models, model.trim()] }),
}));
