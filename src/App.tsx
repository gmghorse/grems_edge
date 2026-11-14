import React from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Charger } from "@/types/charger";
import type { Connector } from "@/types/connector";
import type { Session } from "@/types/session";
import { useChargerStore } from "@/store/charger-store";
import { useSessionStore } from "@/store/session-store";
import { usePowerHistoryStore } from "@/store/power-history-store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./components/ui/sidebar.tsx";
import {
  ActivityIcon,
  ChargingStationIcon,
  ClockCounterClockwiseIcon,
  GearIcon,
  HouseIcon,
  KeyIcon,
} from "@phosphor-icons/react";
import "./App.css";
import { AnimatePresence, motion } from "framer-motion";

function formatConnectionTime(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

const navItems = [
  { title: "Home", to: "/", icon: HouseIcon },
  { title: "Chargers", to: "/chargers", icon: ChargingStationIcon },
  { title: "Sessions", to: "/sessions", icon: ClockCounterClockwiseIcon },
  { title: "Access", to: "/access", icon: KeyIcon },
  { title: "Events", to: "/events", icon: ActivityIcon },
  { title: "Settings", to: "/settings", icon: GearIcon },
];

function App() {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppLayout></AppLayout>
    </SidebarProvider>
  );
}

function AppLayout() {
  const { pathname } = useLocation();
  const setChargers = useChargerStore((state) => state.setChargers);
  const setSessions = useSessionStore((state) => state.setSessions);
  const updateSession = useSessionStore((state) => state.updateSession);
  useEffect(() => {
    const samplePower = () => {
      const timestamp = Date.now();
      const powerKw =
        useSessionStore
          .getState()
          .sessions.filter((session) => /^(active|charging)$/i.test(session.status))
          .reduce(
            (total, session) => total + Math.max(0, session.last_power_w),
            0,
          ) / 1000;
      usePowerHistoryStore.getState().addSample({ timestamp, powerKw });
    };
    samplePower();
    const timer = window.setInterval(samplePower, 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    const startupStartedAt = Date.now();
    const minimumSplashDurationMs = 1000;
    type ChargerRecord = {
      charger: Omit<
        Charger,
        | "connectors"
        | "status"
        | "location"
        | "faultAlerts"
        | "qrCodes"
        | "since"
      >;
      connectors: (Omit<Connector, "connector_type"> & {
        connector_type: string;
      })[];
    };
    const load = async (initialLoad = false) => {
      try {
        const [records, sessions] = await Promise.all([
          invoke<ChargerRecord[]>("load_chargers"),
          invoke<Session[]>("load_sessions"),
        ]);
        if (!active) return;
        setSessions(sessions);
        setChargers(
          records.map(({ charger, connectors }) => {
            const normalizedConnectors: Connector[] = connectors.map(
              (connector) => {
                let connectorTypes: string[];
                try {
                  const parsed: unknown = JSON.parse(connector.connector_type);
                  connectorTypes = Array.isArray(parsed)
                    ? parsed
                    : [String(parsed)];
                } catch {
                  connectorTypes = [connector.connector_type];
                }
                return { ...connector, connector_type: connectorTypes };
              },
            );
            // The online flag survives an unclean app shutdown. Trust it only
            // while the charger has sent a recent OCPP heartbeat.
            const lastHeartbeat = charger.last_heartbeat_at
              ? Date.parse(charger.last_heartbeat_at)
              : Number.NaN;
            const isRecentlyOnline =
              charger.is_online === 1 &&
              Number.isFinite(lastHeartbeat) &&
              Date.now() - lastHeartbeat <= 2 * 60_000;
            const status =
              !isRecentlyOnline
                ? "Disconnected"
                : normalizedConnectors.some(
                      (connector) => connector.status === "Faulted",
                    )
                  ? "Faulted"
                  : normalizedConnectors.some(
                        (connector) => connector.status === "Charging",
                      )
                    ? "Charging"
                    : "Ready";
            return {
              ...charger,
              connectors: normalizedConnectors,
              status,
              location: charger.name,
              faultAlerts: true,
              qrCodes: {},
              power: isRecentlyOnline
                ? normalizedConnectors.reduce(
                    (sum, connector) => sum + (connector.power_kw || 0),
                    0,
                  )
                : 0,
              since: charger.last_heartbeat_at
                ? `Last seen ${formatConnectionTime(charger.last_heartbeat_at)}`
                : "Not yet connected",
            };
          }),
        );
      } catch (error) {
        console.error("Failed to load chargers:", error);
      } finally {
        if (active && initialLoad) {
          const remainingSplashTime = Math.max(
            0,
            minimumSplashDurationMs - (Date.now() - startupStartedAt),
          );
          window.setTimeout(() => {
            if (!active) return;
            void invoke("app_ready").catch((error) => {
              console.error("Failed to finish app startup:", error);
            });
          }, remainingSplashTime);
        }
      }
    };
    void load(true);
    let unlisten: (() => void) | undefined;
    let refreshTimer: number | undefined;
    void listen<{
      action?: string;
      sessionUpdate?: Partial<Session> & { id: string };
    }>("charger-state-updated", (event) => {
      if (event.payload.sessionUpdate) {
        // Apply the persisted meter sample directly; avoid waiting for a
        // separate SQLite reload before the Recent Sessions row changes.
        const { id, ...updates } = event.payload.sessionUpdate;
        updateSession(id, updates);
        return;
      }
      window.clearTimeout(refreshTimer);
      // OCPP messages are already persisted before the event is emitted; keep
      // only a short coalescing window for bursts of connector updates.
      refreshTimer = window.setTimeout(() => {
        void load();
      }, 20);
    })
      .then((stopListening) => {
        if (active) unlisten = stopListening;
        else stopListening();
      })
      .catch((error) =>
        console.error("Failed to subscribe to charger updates:", error),
      );
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      unlisten?.();
    };
  }, [setChargers, setSessions, updateSession]);
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);
  const { state } = useSidebar();
  return (
    <>
      <Sidebar variant={"floating"} collapsible={"icon"} className={""}>
        <div className={"flex h-full flex-col"}>
          <SidebarHeader>
            <AnimatePresence mode={"wait"} initial={false}>
              {state !== "collapsed" && (
                <motion.h2
                  key="sidebar-header"
                  initial={{ opacity: 0, height: 0, x: -10 }}
                  animate={{ opacity: 1, height: "auto", x: 0 }}
                  exit={{ opacity: 0, height: 0, x: -10 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden whitespace-nowrap px-2 py-2 text-md font-semibold font-display"
                >
                  Grems EV Edge
                </motion.h2>
              )}
            </AnimatePresence>
          </SidebarHeader>

          <SidebarContent className={"flex-1"}>
            <SidebarMenu className="p-2">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to} className={"mb-2"}>
                  <SidebarMenuButton
                    isActive={isActive(item.to)}
                    render={<NavLink to={item.to} />}
                    className={isActive(item.to) ? "text-primary!" : ""}
                  >
                    <item.icon
                      weight="bold"
                      size={32}
                      color={isActive(item.to) ? "#32cd32" : "currentColor"}
                    />

                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className={"mt-auto"}>
            <AnimatePresence mode="wait" initial={false}>
              {state !== "collapsed" ? (
                <motion.div
                  key="footer-expanded"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden whitespace-nowrap p-2 text-muted-foreground text-xs"
                >
                  Grems EV Edge v1.0
                </motion.div>
              ) : (
                <motion.div
                  key="footer-collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="p-2 text-xs text-muted-foreground"
                >
                  v1.0
                </motion.div>
              )}
            </AnimatePresence>
          </SidebarFooter>
        </div>
      </Sidebar>

      <main className="flex-1 p-4">
        <SidebarTrigger />
        <Outlet />
      </main>
    </>
  );
}

export default App;
