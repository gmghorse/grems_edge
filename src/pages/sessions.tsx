import { useEffect, useState } from "react";
import {
  DownloadSimpleIcon,
  LightningIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { PageHeader, MetricCard, SectionTitle } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Session } from "@/types/session";
import { useSessionStore } from "@/store/session-store";
import { useChargerStore } from "@/store/charger-store";

export default function Sessions() {
  const sessions = useSessionStore((state) => state.sessions);
  const chargers = useChargerStore((state) => state.chargers);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const wallClockStart = Date.now();
    const monotonicStart = performance.now();
    const timer = window.setInterval(() => {
      setClock(wallClockStart + performance.now() - monotonicStart);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  const today = new Date();
  const todaySessions = sessions.filter((session) => {
    const start = new Date(session.start_time);
    return !Number.isNaN(start.getTime()) && start.toDateString() === today.toDateString();
  });
  const energyToday = todaySessions.reduce((total, session) => total + session.last_energy_wh / 1000, 0);
  const activeSessions = sessions.filter((session) => session.status === "Active").length;
  const chargerLabel = (sessionCharger: string) => {
    const id = sessionCharger.split(" · ")[0];
    const charger = chargers.find((item) => item.id === id || item.ocpp_identity === id);
    return charger ? `${charger.ocpp_identity} · ${charger.name}` : sessionCharger;
  };
  const formatDateTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Time unavailable"
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const formatDuration = (session: Session) => {
    const start = new Date(session.start_time).getTime();
    const isActive = /^(active|charging)$/i.test(session.status);
    const end = isActive ? clock : new Date(session.end_time).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return session.duration;
    const totalSeconds = Math.max(0, Math.floor((end - start) / 1_000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} min ${String(seconds).padStart(2, "0")} sec`;
  };
  const accessMethod = (origin: string) => ({
    mobile_app: "Mobile app",
    rfid_card: "RFID card",
    fleet_portal: "Fleet portal",
    charger: "Charger initiated",
  }[origin] ?? origin.replace(/_/g, " "));
  const credentialLabel = (value: string) => value ? `•••• ${value.slice(-4)}` : "No credential recorded";
  const sessionReference = (id: string) => `Session ${id.slice(-6).toUpperCase()}`;
  const stopReasonLabel = (reason: string) => ({
    None: "Not provided",
    EVDisconnected: "Vehicle disconnected",
    EVCommunicationLost: "Vehicle communication lost",
    HardReset: "Hard reset",
    Local: "Stopped at charger",
    Other: "Other reason",
    PowerLoss: "Power loss",
    Reboot: "Charger rebooted",
    Remote: "Stopped remotely",
    SoftReset: "Soft reset",
    UnlockCommand: "Connector unlocked",
    DeAuthorized: "Authorization withdrawn",
  }[reason] ?? reason.replace(/([a-z])([A-Z])/g, "$1 $2"));
  const formatCost = (session: Session) => {
    if (session.cost_value == null || !session.currency) return session.cost;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: session.currency }).format(session.cost_value);
    } catch {
      return `${session.currency} ${session.cost_value.toFixed(2)}`;
    }
  };
  const [tab, setTab] = useState("All sessions");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const currentSelectedSession = selectedSession
    ? sessions.find((session) => session.id === selectedSession.id) ?? selectedSession
    : null;
  const rows = sessions.filter(
    (s) =>
      tab === "All sessions" ||
      (tab === "Active" ? s.status === "Active" : s.status === "Completed"),
  );
  const openInfo = (session: Session) => setSelectedSession(session);
  const closeInfo = () => setSelectedSession(null);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Charging activity"
        title="Sessions"
        description="Review charging activity and energy delivered."
        action={
          <Button variant="outline">
            <DownloadSimpleIcon /> Export report
          </Button>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Sessions today"
          value={String(todaySessions.length)}
          detail="Across all chargers"
        />
        <MetricCard
          label="Energy delivered"
          value={`${energyToday.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kWh`}
          detail="kWh delivered today"
        />
        <MetricCard label="Active now" value={String(activeSessions)} detail="Currently charging" />
      </section>
      <section className="rounded-xl border p-5 sm:p-6">
        <SectionTitle
          title="Recent sessions"
          detail="Live and completed charging records"
        />
        <div className="mt-5 flex gap-2">
          {["All sessions", "Active", "Completed"].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 font-medium">CHARGER</th>
                <th className="py-3 font-medium">DURATION</th>
                <th className="py-3 font-medium">ENERGY</th>
                <th className="py-3 font-medium">POWER</th>
                <th className="py-3 font-medium">COST</th>
                <th className="py-3 font-medium">STATUS</th>
                <th>
                  <span className="sr-only">Info</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-4">
                    <p className="font-medium">{chargerLabel(s.charger)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(s.start_time)}
                    </p>
                  </td>
                  <td className="py-4">{formatDuration(s)}</td>
                  <td className="py-4 font-mono tabular-nums">{s.energy}</td>
                  <td className="py-4">
                    <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                      {s.status === "Active" && s.power !== "—" && (
                        <span className="size-2 animate-pulse rounded-full bg-primary" />
                      )}
                      {s.status === "Active" && s.power === "—" ? "Waiting for meter data" : s.power}
                    </span>
                    {s.status === "Active" && s.power !== "—" && (
                      <span className="ml-2 text-xs text-primary">Live</span>
                    )}
                  </td>
                  <td className="py-4 font-mono tabular-nums">{formatCost(s)}</td>
                  <td className="py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.status === "Active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      <LightningIcon />
                      {s.status === "Active" ? "Charging" : "Completed"}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openInfo(s)}
                    >
                      <InfoIcon /> Info
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    No sessions to show in this view yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Drawer
        open={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) closeInfo();
        }}
        swipeDirection="right"
      >
        <DrawerContent className="w-[min(92vw,28rem)] border-l bg-background">
          {currentSelectedSession && (
            <div className="flex h-full min-h-0 flex-col">
              <DrawerHeader className="px-6 pt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Charging session info
                </p>
                <DrawerTitle className="mt-2 text-xl">
                  {chargerLabel(currentSelectedSession.charger)}
                </DrawerTitle>
                <DrawerDescription>Connector {currentSelectedSession.connector_number || "—"} · {accessMethod(currentSelectedSession.origin)}</DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Session", sessionReference(currentSelectedSession.id)],
                    ["Connector", String(currentSelectedSession.connector_number || "—")],
                    ["Access method", accessMethod(currentSelectedSession.origin)],
                    ["Credential", credentialLabel(currentSelectedSession.user)],
                    ["Started", formatDateTime(currentSelectedSession.start_time)],
                    ["Last meter update", currentSelectedSession.last_reading_at ? formatDateTime(currentSelectedSession.last_reading_at) : "Waiting for meter data"],
                    ["Duration", formatDuration(currentSelectedSession)],
                    ["Energy delivered", currentSelectedSession.energy],
                    ["Power", currentSelectedSession.power === "—" && currentSelectedSession.status === "Active" ? "Waiting for meter data" : currentSelectedSession.power],
                    ["Current cost", formatCost(currentSelectedSession)],
                    ["Status", currentSelectedSession.status === "Active" ? "Charging" : "Completed"],
                    ...(currentSelectedSession.status === "Completed" ? [["Stop reason", stopReasonLabel(currentSelectedSession.stop_reason)]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  {currentSelectedSession.status === "Active"
                    ? currentSelectedSession.last_reading_at
                      ? "Power and delivered energy update as the charger reports meter values."
                      : "Waiting for the charger’s first meter reading."
                    : "This charging session has ended."}
                </p>
              </div>
              <DrawerFooter className="flex-row justify-end border-t px-6 py-4">
                <DrawerClose
                  render={<Button type="button" variant="outline" />}
                >
                  Close
                </DrawerClose>
              </DrawerFooter>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </main>
  );
}
