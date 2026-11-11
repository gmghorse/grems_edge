import { create } from "zustand";
import type { Credential } from "@/types/credential";

const initialCredentials: Credential[] = [
  // {
  //   id: "4821",
  //   name: "Facility operations",
  //   assigned: "Operations team",
  //   lastUsed: "Today, 10:42 AM",
  //   status: "Active",
  // },
  // {
  //   id: "1903",
  //   name: "Fleet access",
  //   assigned: "Fleet team",
  //   lastUsed: "Today, 9:28 AM",
  //   status: "Active",
  // },
  // {
  //   id: "3055",
  //   name: "Maintenance key",
  //   assigned: "Service partner",
  //   lastUsed: "Oct 21, 2:05 PM",
  //   status: "Revoked",
  // },
];

type CredentialStore = {
  credentials: Credential[];
  setCredentials: (credentials: Credential[]) => void;
  addCredential: (credential: Credential) => void;
  updateCredential: (id: string, updates: Partial<Credential>) => void;
  removeCredential: (id: string) => void;
};

export const useCredentialStore = create<CredentialStore>((set) => ({
  credentials: initialCredentials,
  setCredentials: (credentials) => set({ credentials }),
  addCredential: (credential) =>
    set((state) => ({ credentials: [...state.credentials, credential] })),
  updateCredential: (id, updates) =>
    set((state) => ({
      credentials: state.credentials.map((credential) =>
        credential.id === id ? { ...credential, ...updates } : credential,
      ),
    })),
  removeCredential: (id) =>
    set((state) => ({
      credentials: state.credentials.filter(
        (credential) => credential.id !== id,
      ),
    })),
}));
