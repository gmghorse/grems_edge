CREATE TABLE edge_config
(
    key   text
        constraint edge_config_pk
            primary key,
    value text
);
CREATE TABLE sync_state
(
    id                    integer not null
        constraint sync_state_pk
            primary key,
    cloud_connected       integer not null,
    last_cloud_contact_at TEXT,
    last_acked_seq        integer,
    config_cursor         TEXT
);
CREATE TABLE chargers
(
    id                 text              not null
        constraint chargers_pk
            primary key,
    ocpp_identity      text              not null
        constraint chargers_pk_2
            unique,
    serial_number      text              not null
        constraint chargers_pk_3
            unique,
    vendor             text              not null,
    model              text              not null,
    firmware_version   text              not null,
    auth_password_hash text              not null,
    is_active          integer default 0 not null,
    is_online          integer default 0 not null,
    last_heartbeat_at  text              not null,
    last_boot_at       text              not null,
    stop_latency_ms    integer           not null,
    updated_at         text              not null
);
CREATE TABLE connectors
(
    id                text not null
        constraint connectors_pk
            primary key,
    charger_id        text
        constraint connectors_chargers_id_fk
            references chargers,
    connector_number  integer,
    connector_type    text,
    power_kw          REAL,
    allowed_power_kw  REAL,
    status            text not null,
    error_code        text,
    status_updated_at text
);
CREATE TABLE tariffs
(
    id                  text
        constraint tariffs_pk
            primary key,
    connector_type      text,
    price_per_kwh_minor real not null,
    currency            text,
    effective_from      text not null
);
CREATE TABLE session_budgets
(
    hold_id      text
        constraint session_budgets_pk
            primary key,
    budget_minor real not null,
    spent_minor  real not null,
    currency     text,
    status       text,
    updated_at   text
);
CREATE TABLE ocpp_transactions (
                                   transaction_id  INTEGER PRIMARY KEY AUTOINCREMENT,
                                   session_id      TEXT NOT NULL
);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE sessions (
                          id                           TEXT PRIMARY KEY,
                          connector_id                 TEXT NOT NULL REFERENCES connectors(id),
                          origin                       TEXT NOT NULL,
                          billable                     INTEGER NOT NULL,
                          hold_id                      TEXT REFERENCES session_budgets(hold_id),
                          command_id                   TEXT,
                          id_tag                       TEXT,
                          ocpp_transaction_id          INTEGER REFERENCES ocpp_transactions(transaction_id),
                          status                       TEXT NOT NULL,
                          tariff_id                    TEXT,
                          rate_snapshot_minor_per_kwh  INTEGER,
                          currency                     TEXT,
                          meter_start_wh               INTEGER,
                          meter_stop_wh                INTEGER,
                          energy_wh                    INTEGER,
                          last_energy_wh               INTEGER,
                          last_power_w                 INTEGER,
                          last_reading_at              TEXT,
                          started_at                   TEXT,
                          ended_at                     TEXT,
                          stop_reason                  TEXT,
                          overshoot_wh                 INTEGER NOT NULL DEFAULT 0,
                          created_at                   TEXT NOT NULL,
                          updated_at                   TEXT NOT NULL
);
CREATE INDEX idx_sessions_connector ON sessions(connector_id);
CREATE INDEX idx_sessions_hold      ON sessions(hold_id);
CREATE INDEX idx_sessions_status    ON sessions(status);
CREATE INDEX idx_sessions_txn       ON sessions(ocpp_transaction_id);
CREATE TABLE pending_starts (
                                id_tag        TEXT PRIMARY KEY,
                                session_id    TEXT NOT NULL REFERENCES sessions(id),
                                connector_id  TEXT NOT NULL REFERENCES connectors(id),
                                expires_at    TEXT NOT NULL
);
CREATE TABLE meter_values (
                              id           INTEGER PRIMARY KEY AUTOINCREMENT,
                              session_id   TEXT NOT NULL REFERENCES sessions(id),
                              measured_at  TEXT NOT NULL,
                              energy_wh    INTEGER,
                              power_w      INTEGER,
                              current_a    REAL,
                              voltage_v    REAL,
                              soc_percent  INTEGER
);
CREATE INDEX idx_meter_session ON meter_values(session_id, measured_at);
CREATE INDEX idx_meter_prune   ON meter_values(measured_at);
CREATE TABLE inbound_commands (
                                  id           TEXT PRIMARY KEY,
                                  type         TEXT NOT NULL,
                                  payload      TEXT NOT NULL,
                                  status       TEXT NOT NULL DEFAULT 'received',
                                  result       TEXT,
                                  expires_at   TEXT,
                                  received_at  TEXT NOT NULL,
                                  finished_at  TEXT
);
CREATE TABLE outbox (
                        seq         INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_id    TEXT NOT NULL,
                        type        TEXT NOT NULL,
                        payload     TEXT NOT NULL,
                        created_at  TEXT NOT NULL,
                        sent_at     TEXT,
                        acked_at    TEXT
);
CREATE INDEX idx_outbox_acked ON outbox(acked_at);
CREATE TABLE ocpp_message_log (
                                  id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                  charger_id  TEXT REFERENCES chargers(id),
                                  direction   TEXT NOT NULL,
                                  action      TEXT,
                                  message_id  TEXT,
                                  payload     TEXT,
                                  logged_at   TEXT NOT NULL
);
CREATE INDEX idx_ocpp_log_time ON ocpp_message_log(logged_at);
