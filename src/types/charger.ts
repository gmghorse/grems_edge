import type { Connector } from "@/types/connector";

export type Charger = {
  // Columns persisted in the chargers table.
  /** Internal database primary key; use this only for local relationships. */
  id: string;
  /** Charge point identity sent by the charger and used in its OCPP WebSocket URL. */
  ocpp_identity: string;
  serial_number: string;
  vendor: string | null;
  model: string | null;
  firmware_version: string | null;
  is_active: number;
  is_online: number;
  last_heartbeat_at: string | null;
  last_boot_at: string | null;
  stop_latency_ms: number;
  updated_at: string;
  name: string;
  connector_count: number;
  /** JSON text stored in chargers.connector_types. */
  connector_types: string;
  power: number | null;

  // Related connector rows and UI-derived display values.
  connectors: Connector[];
  status: string;
  location?: string;
  faultAlerts?: boolean;
  qrCodes?: Record<number, string>;
  since?: string;
};
