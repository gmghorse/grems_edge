import { create } from "zustand";
import type { Charger } from "@/types/charger";

type ChargerStore = {
  chargers: Charger[];
  setChargers: (chargers: Charger[]) => void;
  addCharger: (charger: Charger) => void;
  updateCharger: (id: string, updates: Partial<Charger>) => void;
  removeCharger: (id: string) => void;
};

export const useChargerStore = create<ChargerStore>((set) => ({
  chargers: [],
  setChargers: (chargers) => set({ chargers }),
  addCharger: (charger) =>
    set((state) => ({ chargers: [...state.chargers, charger] })),
  updateCharger: (id, updates) =>
    set((state) => ({
      chargers: state.chargers.map((charger) =>
        charger.id === id ? { ...charger, ...updates } : charger,
      ),
    })),
  removeCharger: (id) =>
    set((state) => ({
      chargers: state.chargers.filter((charger) => charger.id !== id),
    })),
}));
