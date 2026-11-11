export type Connector = {
  id: string;
  charger_id: string;
  connector_number: number;
  connector_type: string[];
  power_kw: number;
  allowed_power_kw: number;
  status: string;
  error_code: string | null;
  status_updated_at: string | null;
};
