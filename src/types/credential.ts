export type Credential = {
  id: string;
  name: string;
  assigned: string;
  lastUsed: string;
  status: "Active" | "Revoked";
};

export type CredentialDraft = {
  name: string;
  credentialId: string;
  assigned: string;
  active: boolean;
};
