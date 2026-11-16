import { useMemo, useState } from "react";
import React from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ChargingStationIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  PlugsConnectedIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { Fieldset, Input } from "@headlessui/react";
import { MetricCard, PageHeader, SectionTitle } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { Charger } from "@/types/charger";
import type { Connector } from "@/types/connector";
import { useChargerStore } from "@/store/charger-store";
import { useChargerModelStore } from "@/store/charger-model-store";
import { Spinner } from "@/components/ui/spinner";
import { delay } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const connectorTypes = [
  "Type 2",
  "Type 1",
  "CCS2",
  "CCS1",
  "CHAdeMO",
  "GB/T AC",
  "GB/T DC",
  "NACS AC",
  "NACS DC",
];
const connectorTypeGroup = (type: string): "AC" | "DC" =>
  ["CCS2", "CCS1", "CHAdeMO", "GB/T DC", "NACS DC"].includes(type)
    ? "DC"
    : "AC";

const formatConnection = (value?: string): string => {
  if (!value || value === "Not yet connected")
    return value ?? "Not yet connected";
  const rawTimestamp = value.startsWith("Last seen ")
    ? value.slice("Last seen ".length)
    : value;
  const timestamp = new Date(rawTimestamp);
  if (Number.isNaN(timestamp.getTime())) return value;
  return `Last seen ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp)}`;
};

const stateClass: Record<string, string> = {
  Charging: "bg-primary/10 text-primary",
  Ready: "bg-muted text-muted-foreground",
  Faulted: "bg-orange-500/10 text-orange-600",
  Disconnected: "bg-orange-500/10 text-orange-600",
};
type ChargerDraft = Pick<
  Charger,
  "name" | "location" | "faultAlerts" | "qrCodes" | "auth_password_hash"
> & {
  connectorTypes: Record<number, string[]>;
  qrCodes: Record<number, string>;
};
export default function Chargers() {
  const chargers = useChargerStore((state) => state.chargers);
  const addChargerToStore = useChargerStore((state) => state.addCharger);
  const updateCharger = useChargerStore((state) => state.updateCharger);
  const chargerModels = useChargerModelStore((state) => state.models);
  const [showPassword, setShowPassword] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedCharger, setSelectedCharger] = useState<Charger | null>(null);
  const [draft, setDraft] = useState<ChargerDraft | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [isAddingCharger, setIsAddingCharger] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectChargerIdentity, setConnectChargerIdentity] = useState("");
  const [usePasswordAuth, setUsePasswordAuth] = useState(false);
  const [newName, setNewName] = useState("");
  const [newModel, setNewModel] = useState("GREMS AC");

  const [newConnectorTypes, setNewConnectorTypes] = useState<string[]>([
    "Type 2",
  ]);
  const [connectorTypeNotices, setConnectorTypeNotices] = useState<
    Record<string, string>
  >({});
  const visible = useMemo(
    () =>
      chargers.filter(
        (c) =>
          (filter === "All" || c.status === filter) &&
          `${c.id} ${c.name} ${c.status}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [chargers, filter, query],
  );
  const readyCount = chargers.filter(
    (charger) => charger.status === "Ready",
  ).length;
  const disconnectedCount = chargers.filter(
    (charger) =>
      charger.status === "Disconnected" || charger.status === "Faulted",
  ).length;
  const openSettings = (charger: Charger) => {
    setSelectedCharger(charger);
    setDraft({
      name: charger.name,
      location: charger.location,
      faultAlerts: charger.faultAlerts,
      qrCodes: charger.qrCodes ?? {},
      auth_password_hash: charger.auth_password_hash ?? "",
      connectorTypes: Object.fromEntries(
        charger.connectors.map((connector) => [
          connector.connector_number,
          connector.connector_type,
        ]),
      ),
    });
  };
  const closeSettings = () => setSelectedCharger(null);
  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCharger || !draft) return;
    if (
      selectedCharger.connectors.some(
        (connector) =>
          !draft.connectorTypes[connector.connector_number]?.length,
      )
    )
      return;
    updateCharger(selectedCharger.id, {
      name: draft.name,
      location: draft.location,
      faultAlerts: draft.faultAlerts,
      qrCodes: draft.qrCodes,
      auth_password_hash: draft.auth_password_hash,
      connectors: selectedCharger.connectors.map((connector) => ({
        ...connector,
        connector_type:
          draft.connectorTypes[connector.connector_number] ??
          connector.connector_type,
      })),
    });
    setIsSavingSettings(true);
    try {
      await delay(1000);
      invoke<Charger>("update_charger", {
        charger: {
          id: selectedCharger.id,
          name: draft.name,
          location: draft.location,
        },
      });
    } catch (error) {}
    setIsSavingSettings(false);
    closeSettings();
  };
  const nextChargerIdentity = `GR-${String(Math.max(0, ...chargers.map((charger) => Number(charger.ocpp_identity.replace(/^GR-/, ""))).filter(Number.isFinite)) + 1).padStart(3, "0")}`;
  const addCharger = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (!newConnectorTypes.length) return;
    const chargerConnectorIds = newConnectorTypes.map((_, index) => index + 1);
    let charger: Charger;
    setIsAddingCharger(true);
    const spinnerDelay = new Promise((resolve) => setTimeout(resolve, 450));
    try {
      const [savedCharger, savedConnectors] = await invoke<
        [
          Charger,
          (Omit<Connector, "connector_type"> & { connector_type: string })[],
        ]
      >("create_charger", {
        charger: {
          id: "",
          ocpp_identity: nextChargerIdentity,
          serial_number: "",
          vendor: "GREMS",
          model: newModel.trim() || null,
          firmware_version: null,
          auth_password_hash: null,
          is_active: 1,
          is_online: 0,
          last_heartbeat_at: null,
          last_boot_at: null,
          stop_latency_ms: 3000,
          updated_at: new Date().toISOString(),
          name,
          connector_count: chargerConnectorIds.length,
          connector_types: JSON.stringify(
            newConnectorTypes.map((type) => [type]),
          ),
          power: null,
        },
        connectors: chargerConnectorIds.map((number) => ({
          id: "",
          // The backend assigns the generated charger ID before inserting.
          charger_id: "",
          connector_number: number,
          connector_type: JSON.stringify([newConnectorTypes[number - 1]]),
          power_kw: 0,
          allowed_power_kw: newModel.includes("DC") ? 60 : 22,
          status: "Disconnected",
          error_code: null,
          status_updated_at: null,
        })),
      });
      await spinnerDelay;
      charger = {
        ...savedCharger,
        connectors: savedConnectors.map((connector) => ({
          ...connector,
          connector_type: JSON.parse(connector.connector_type) as string[],
        })),
        status: "Disconnected",
        power: null,
        since: "Not yet connected",
      };
      setAddOpen(false);
    } catch (error) {
      console.error("Failed to create charger:", error);
      window.alert(`Could not add charger: ${String(error)}`);
      return;
    } finally {
      setIsAddingCharger(false);
    }
    addChargerToStore(charger);
    setFilter("All");
    setQuery("");
    setAddOpen(false);
    setNewName("");
  };
  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Station equipment"
        title="Chargers"
        description="Monitor charger availability and connection health."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConnectOpen(true)}>
              <PlugsConnectedIcon /> Connect charger
            </Button>
            <Button
              onClick={() => {
                setNewName("");

                setNewModel("GREMS AC");
                setNewConnectorTypes(["Type 2"]);
                // setNewConnectorTypes({ 1: ["Type 2"], 2: ["Type 2"] });
                setAddOpen(true);
              }}
            >
              <PlusIcon /> Add charger
            </Button>
          </div>
        }
      />
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[85dvh] gap-0 overflow-hidden border-border bg-background p-3 sm:max-w-lg sm:p-4"
        >
          <div className="charger-guide-scroll max-h-[calc(85dvh-2rem)] space-y-6 overflow-y-auto overscroll-contain rounded-lg px-6 py-6 sm:max-h-[calc(85dvh-2rem)] sm:px-8 sm:py-8">
            <DialogHeader className="space-y-3">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                Connect your charger
              </DialogTitle>
              <DialogDescription className="text-sm leading-6">
                Add this edge server in the charger’s dashboard using its OCPP
                connection settings.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-5 text-foreground">
              Make sure the charger and GREMS Edge are on the same network, and
              that the edge server has a reserved static IP address.
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <span className="w-5 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                  1
                </span>
                <p className="text-sm leading-6">
                  Open the charger dashboard and go to{" "}
                  <span className="font-medium text-foreground">OCPP</span> or{" "}
                  <span className="font-medium text-foreground">CSMS</span>{" "}
                  settings.
                </p>
              </div>
              <div className="flex gap-4">
                <span className="w-5 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6">
                    Choose a charger to generate its connection details:
                  </p>
                  <label className="mt-3 block text-xs font-medium text-muted-foreground">
                    Charger
                    <select
                      className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      value={
                        connectChargerIdentity ||
                        chargers[0]?.ocpp_identity ||
                        ""
                      }
                      onChange={(event) =>
                        setConnectChargerIdentity(event.target.value)
                      }
                    >
                      {chargers.map((charger) => (
                        <option key={charger.id} value={charger.ocpp_identity}>
                          {charger.name} · {charger.ocpp_identity}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        Server URL (simulator on this computer)
                      </p>
                      <code className="block break-all rounded-md border bg-background px-3 py-2.5 font-mono text-xs leading-5">
                        ws://127.0.0.1:9000/ocpp/
                        {connectChargerIdentity ||
                          chargers[0]?.ocpp_identity ||
                          "GR-001"}
                      </code>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        Charger OCPP identity
                      </p>
                      <code className="block rounded-md border bg-background px-3 py-2.5 font-mono text-xs">
                        {connectChargerIdentity ||
                          chargers[0]?.ocpp_identity ||
                          "GR-001"}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="w-5 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-sm leading-6">
                    Save the settings, then check back here for its connection
                    status.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={usePasswordAuth}
                      onChange={(event) =>
                        setUsePasswordAuth(event.target.checked)
                      }
                    />
                    Enable password authentication (optional)
                  </label>
                  {usePasswordAuth && (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Set the same OCPP password on this edge server and in the
                      charger’s dashboard.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
              For a simulator on another computer, replace 127.0.0.1 with this
              edge server computer’s LAN IP. Keep port 9000 and the selected
              charger’s OCPP identity.
            </p>
            <DialogFooter className="mx-0 mb-0 border-t bg-transparent px-0 pb-0 pt-5">
              <Button onClick={() => setConnectOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total chargers"
          value={String(chargers.length)}
          detail="Across this station"
        />
        <MetricCard
          label="Available"
          value={String(readyCount)}
          detail="Ready for a new session"
        />
        <MetricCard
          label="Needs attention"
          value={String(disconnectedCount)}
          detail="Disconnected from the edge server"
        />
      </section>
      <section className="rounded-xl border p-5 sm:p-6">
        <SectionTitle
          title="All chargers"
          detail={`${visible.length} of ${chargers.length} chargers`}
        />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-2">
            {["All", "Charging", "Ready", "Faulted", "Disconnected"].map(
              (f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ),
            )}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 font-medium">CHARGER</th>
                <th className="py-3 font-medium">STATUS</th>
                <th className="py-3 font-medium">OUTPUT</th>
                <th className="py-3 font-medium">CONNECTION</th>
                <th className="py-3 font-medium">
                  <span className="sr-only">Settings</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ChargingStationIcon size={18} />
                      </span>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        {/*<p className="mt-0.5 text-xs text-muted-foreground">*/}
                        {/*    {c.id} · {c.model} · {c.connectorCount} connectors (*/}
                        {/*    {[*/}
                        {/*        ...new Set(Object.values(c.connectorTypes).flat()),*/}
                        {/*    ].join(", ")}*/}
                        {/*    ) · Connector IDs {c.connectorIds.join(", ")} ·{" "}*/}
                        {/*    {*/}
                        {/*        c.connectorIds.filter((connectorId) =>*/}
                        {/*            settings[c.id]?.qrCodes?.[connectorId]?.trim(),*/}
                        {/*        ).length*/}
                        {/*    }*/}
                        {/*    /{c.connectorCount} QR codes assigned*/}
                        {/*</p>*/}
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${stateClass[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-4 font-mono tabular-nums">{c.power}</td>
                  <td className="py-4 text-muted-foreground">
                    {formatConnection(c.since)}
                  </td>
                  <td className="py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSettings(c)}
                    >
                      <SlidersHorizontalIcon /> Settings
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No chargers match this search.
            </p>
          )}
        </div>
      </section>
      <Drawer
        open={selectedCharger !== null}
        onOpenChange={(open) => {
          if (!open) closeSettings();
        }}
        swipeDirection="right"
      >
        <DrawerContent className="w-[min(92vw,28rem)] border-l bg-background">
          {selectedCharger && draft && (
            <form
              className="flex h-full min-h-0 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                saveSettings(event);
              }}
            >
              <DrawerHeader className="px-6 pt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Charger configuration
                </p>
                <DrawerTitle className="mt-2 text-xl">
                  {selectedCharger.name}
                </DrawerTitle>
                <DrawerDescription className="text-sm text-muted-foreground">
                  {selectedCharger.ocpp_identity} · {selectedCharger.model}
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <Fieldset className="space-y-4">
                  <label className="block text-sm font-medium">
                    Charger name
                    <Input
                      className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Location
                    <Input
                      className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring"
                      placeholder="Add a location"
                      value={draft.location}
                      onChange={(event) =>
                        setDraft({ ...draft, location: event.target.value })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Password authentication (optional)
                    <div className="relative mt-2">
                      <Input
                        type={showPassword ? "text" : "password"}
                        className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring"
                        placeholder="Add a password for OCPP authentication"
                        value={draft.auth_password_hash ?? ""}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            auth_password_hash: event.target.value,
                          })
                        }
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeSlashIcon size={18} />
                        ) : (
                          <EyeIcon size={18} />
                        )}
                      </button>
                    </div>
                  </label>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Connector setup</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Select all connector types supported directly or through
                        adapters, then assign its QR code.
                      </p>
                    </div>
                    {selectedCharger.connectors.map(
                      ({ connector_number: connectorId }) => (
                        <div
                          key={connectorId}
                          className="space-y-3 rounded-lg border p-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              Connector {connectorId} supported types
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Choose multiple AC types or multiple DC types. A
                              connector cannot use both.
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {connectorTypes.map((type) => {
                                const selectedTypes =
                                  draft.connectorTypes[connectorId] ?? [];
                                const checked = selectedTypes.includes(type);
                                const otherGroupSelected = selectedTypes.some(
                                  (value) =>
                                    connectorTypeGroup(value) !==
                                    connectorTypeGroup(type),
                                );
                                const noticeKey = `settings-${selectedCharger.id}-${connectorId}`;
                                return (
                                  <label
                                    key={type}
                                    className="flex items-center gap-2 text-sm font-normal"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(isChecked) => {
                                        if (
                                          isChecked === true &&
                                          otherGroupSelected
                                        ) {
                                          setConnectorTypeNotices(
                                            (current) => ({
                                              ...current,
                                              [noticeKey]:
                                                "A connector can’t support AC and DC types at the same time. Remove the selected type first.",
                                            }),
                                          );
                                          return;
                                        }
                                        setConnectorTypeNotices((current) => ({
                                          ...current,
                                          [noticeKey]: "",
                                        }));
                                        setDraft({
                                          ...draft,
                                          connectorTypes: {
                                            ...draft.connectorTypes,
                                            [connectorId]:
                                              isChecked === true
                                                ? [...selectedTypes, type]
                                                : selectedTypes.filter(
                                                    (value) => value !== type,
                                                  ),
                                          },
                                        });
                                      }}
                                    />
                                    {type}
                                  </label>
                                );
                              })}
                            </div>
                            {connectorTypeNotices[
                              `settings-${selectedCharger.id}-${connectorId}`
                            ] && (
                              <p
                                role="alert"
                                className="mt-2 text-xs text-destructive"
                              >
                                {
                                  connectorTypeNotices[
                                    `settings-${selectedCharger.id}-${connectorId}`
                                  ]
                                }
                              </p>
                            )}
                          </div>
                          <label className="block text-sm font-medium">
                            Connector {connectorId} QR code
                            <Input
                              className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring"
                              placeholder="Scan or enter QR code value"
                              value={draft.qrCodes[connectorId] ?? ""}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  qrCodes: {
                                    ...draft.qrCodes,
                                    [connectorId]: event.target.value,
                                  },
                                })
                              }
                            />
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {draft.qrCodes[connectorId]?.trim()
                                ? "QR code assigned"
                                : "No QR code assigned"}
                            </span>
                          </label>
                        </div>
                      ),
                    )}
                  </div>
                </Fieldset>
                <div className="divide-y rounded-xl border px-4">
                  <div className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="text-sm font-medium">Fault notifications</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Show an alert when this charger reports a fault.
                      </p>
                    </div>
                    <Switch
                      checked={draft.faultAlerts}
                      onCheckedChange={(faultAlerts) =>
                        setDraft({ ...draft, faultAlerts })
                      }
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-muted/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current status
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {selectedCharger.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedCharger.since}
                  </p>
                </div>
              </div>
              <DrawerFooter className="flex-row justify-end border-t px-6 py-4">
                <DrawerClose
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeSettings}
                    />
                  }
                >
                  Cancel
                </DrawerClose>
                <Button
                  type="submit"
                  disabled={
                    isSavingSettings ||
                    selectedCharger.connectors.some(
                      (connector) =>
                        !draft.connectorTypes[connector.connector_number]
                          ?.length,
                    )
                  }
                >
                  {isSavingSettings && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isSavingSettings ? "Saving..." : "Save settings"}
                </Button>
              </DrawerFooter>
            </form>
          )}
        </DrawerContent>
      </Drawer>
      <Drawer open={addOpen} onOpenChange={setAddOpen} swipeDirection="right">
        <DrawerContent className="w-[min(92vw,28rem)] border-l bg-background">
          <form className="flex h-full min-h-0 flex-col" onSubmit={addCharger}>
            <DrawerHeader className="px-6 pt-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Station equipment
              </p>
              <DrawerTitle className="mt-2 text-xl">Add a charger</DrawerTitle>
              <DrawerDescription>
                Enter the charger details to add it to this station.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <section
                aria-label="Quick guide to adding a charger"
                className="rounded-xl border bg-muted/40 p-4"
              >
                <p className="text-sm font-semibold">Quick guide</p>
                <ol className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      1
                    </span>
                    Enter a recognizable name and the charger model.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      2
                    </span>
                    Select the connector types it supports; connector IDs are
                    assigned automatically.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      3
                    </span>
                    Choose the connector types this charger supports. Each
                    selected type is added as a connector.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      4
                    </span>
                    <span>
                      Select{" "}
                      <span className="font-medium text-foreground">
                        Add charger
                      </span>
                      . It will show as disconnected until it reports to the
                      edge server.
                    </span>
                  </li>
                </ol>
              </section>
              <Fieldset className="space-y-4">
                <label className="block text-sm font-medium">
                  Charger name
                  <Input
                    autoFocus
                    required
                    className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Charger OCPP identity
                  <Input
                    readOnly
                    className="mt-2 block w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                    value={nextChargerIdentity}
                  />
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                    {connectorTypes.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 text-sm font-normal"
                      >
                        <Checkbox
                          checked={newConnectorTypes.includes(type)}
                          onCheckedChange={(isChecked) =>
                            setNewConnectorTypes((current) =>
                              isChecked === true
                                ? [...current, type]
                                : current.filter((value) => value !== type),
                            )
                          }
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              </Fieldset>
              <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                The charger will appear as disconnected until it reports to the
                edge server.
              </p>
            </div>
            <DrawerFooter className="flex-row justify-end border-t px-6 py-4">
              <DrawerClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DrawerClose>
              <Button
                type="submit"
                disabled={isAddingCharger || !newConnectorTypes.length}
              >
                {isAddingCharger ? (
                  <>
                    <Spinner /> Adding…
                  </>
                ) : (
                  <>
                    <PlusIcon /> Add charger
                  </>
                )}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
