import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  CaretRightIcon,
  ChargingStationIcon,
  CheckCircleIcon,
  LightningIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useChargerStore } from "@/store/charger-store";
import { useSessionStore } from "@/store/session-store";
import {
  POWER_WINDOW_MS,
  usePowerHistoryStore,
} from "@/store/power-history-store";

const powerChartConfig = {
  powerKw: { label: "Charging power", color: "var(--primary)" },
} satisfies ChartConfig;
const energyChartConfig = {
  kwh: { label: "Energy delivered", color: "var(--primary)" },
} satisfies ChartConfig;

const powerTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

const formatPowerTime = (value: unknown) => {
  const timestamp = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(timestamp)) return "—";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";

  return powerTimeFormatter.format(date);
};

export default function Home() {
  const chargers = useChargerStore((state) => state.chargers);
  const sessions = useSessionStore((state) => state.sessions);
  const powerHistory = usePowerHistoryStore((state) => state.samples);
  const [powerClock, setPowerClock] = useState(() => Date.now());
  useEffect(() => {
    let frame = 0;
    const updateClock = () => {
      setPowerClock(Date.now());
      frame = window.requestAnimationFrame(updateClock);
    };
    frame = window.requestAnimationFrame(updateClock);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const powerEnd = powerClock;
  const latestPowerSample = powerHistory[powerHistory.length - 1];
  const powerChartData = powerHistory.filter(
    (sample) =>
      Number.isFinite(sample.timestamp) &&
      Number.isFinite(sample.powerKw) &&
      sample.timestamp >= powerEnd - POWER_WINDOW_MS &&
      sample.timestamp < powerEnd,
  );
  if (
    latestPowerSample &&
    latestPowerSample.timestamp >= powerEnd - POWER_WINDOW_MS
  ) {
    powerChartData.push({ timestamp: powerEnd, powerKw: latestPowerSample.powerKw });
  }
  const today = new Date();
  const isActiveSession = (session: (typeof sessions)[number]) =>
    /^(active|charging)$/i.test(session.status);
  const energyTimestamp = (session: (typeof sessions)[number]) => {
    if (!isActiveSession(session)) {
      return session.end_time || session.last_reading_at || session.start_time;
    }
    const latestReading = new Date(
      session.last_reading_at || session.start_time,
    );
    return !Number.isNaN(latestReading.getTime()) &&
      latestReading.toDateString() === today.toDateString()
      ? latestReading.toISOString()
      : today.toISOString();
  };
  const todaySessions = sessions.filter((session) => {
    const timestamp = new Date(energyTimestamp(session));
    return (
      !Number.isNaN(timestamp.getTime()) &&
      timestamp.toDateString() === today.toDateString()
    );
  });
  const totalEnergyToday = todaySessions.reduce(
    (total, session) => total + session.last_energy_wh / 1000,
    0,
  );
  const hourlyEnergy = Array.from({ length: 24 }, (_, hour) => ({
    time: `${String(hour).padStart(2, "0")}:00`,
    kwh: Number(
      todaySessions
        .reduce((total, session) => {
          const start = new Date(session.start_time);
          return start.getHours() === hour
            ? total + session.last_energy_wh / 1000
            : total;
        }, 0)
        .toFixed(2),
    ),
  }));
  const chargerStates = [
    {
      label: "Charging",
      count: chargers.filter((charger) => charger.status === "Charging").length,
      detail: "Delivering power",
      icon: ChargingStationIcon,
      className: "home-state-charging",
    },
    {
      label: "Faulted",
      count: chargers.filter((charger) => charger.status === "Faulted").length,
      detail: "Requires attention",
      icon: ChargingStationIcon,
      className: "home-state-offline",
    },
    {
      label: "Ready",
      count: chargers.filter((charger) => charger.status === "Ready").length,
      detail: "Connected and available",
      icon: ChargingStationIcon,
      className: "home-state-ready",
    },
    {
      label: "Disconnected",
      count: chargers.filter((charger) => charger.status === "Disconnected")
        .length,
      detail: "Not reporting to the edge server",
      icon: ChargingStationIcon,
      className: "home-state-offline",
    },
  ];
  const disconnectedCount = chargerStates
    .filter(
      (state) => state.label === "Disconnected" || state.label === "Faulted",
    )
    .reduce((total, state) => total + state.count, 0);
  return (
    <main className="home-dashboard mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 font-display sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="size-2 rounded-full bg-primary" /> Station edge
            server
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Charger overview
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A quick view of charger status at this station.
          </p>
        </div>
        <Link
          to="/chargers"
          className="home-text-link inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          View all chargers <CaretRightIcon size={16} weight="bold" />
        </Link>
      </header>

      <section
        aria-label="Charger status"
        className="flex flex-row gap-8 flex-wrap"
      >
        {chargerStates.map((state) => {
          const Icon = state.icon;
          return state.count === 0 ? null : (
            <article
              key={state.label}
              className={`home-state-card ${state.className} w-64 rounded-xl border p-5 sm:p-6`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {state.label}
                  </p>
                  <p className="mt-4 font-mono text-5xl font-semibold tracking-tight tabular-nums">
                    {String(state.count).padStart(2, "0")}
                  </p>
                </div>
                <span className="home-state-icon flex size-10 items-center justify-center rounded-xl">
                  <Icon
                    size={20}
                    weight="fill"
                    color={
                      state.label == "Disconnected"
                        ? "#e77400"
                        : state.label == "Charging"
                          ? "#32cd32"
                          : "#ffffff"
                    }
                  />
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {state.detail}
              </p>
            </article>
          );
        })}
      </section>

      {chargers.length === 0 ? (
        <section>
          <article className="flex flex-col justify-between gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground">
                <WarningCircleIcon size={22} weight="fill" />
              </span>
              <div>
                <h2 className="font-semibold">No chargers connected</h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Add a charger and connect it to this edge server to see its
                  status here.
                </p>
              </div>
            </div>
            <Button
              render={<Link to="/chargers" />}
              variant="outline"
              className="shrink-0"
            >
              Add a charger <CaretRightIcon size={16} weight="bold" />
            </Button>
          </article>
        </section>
      ) : disconnectedCount > 0 ? (
        <section>
          <article className="border-warning flex flex-col justify-between gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl">
                <WarningCircleIcon size={22} weight="fill" color={"#e77400"} />
              </span>
              <div>
                <h2 className="font-semibold">
                  {disconnectedCount}{" "}
                  {disconnectedCount === 1 ? "charger needs" : "chargers need"}{" "}
                  attention
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                  These chargers are disconnected from the edge server. Check
                  their connection status and details.
                </p>
              </div>
            </div>
            <Button
              render={<Link to="/chargers" />}
              variant="outline"
              className="shrink-0"
            >
              Review chargers <CaretRightIcon size={16} weight="bold" />
            </Button>
          </article>
        </section>
      ) : (
        <section>
          <article className=" border-primary flex flex-col justify-between gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl">
                <CheckCircleIcon size={22} weight="fill" color={"#32cd32"} />
              </span>
              <div>
                <h2 className="font-semibold">All chargers are operational</h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                  All chargers are connected to the edge server and operating
                  normally. No issues require your attention.
                </p>
              </div>
            </div>
            <Button
              render={<Link to="/chargers" />}
              variant="outline"
              className="shrink-0"
            >
              View chargers <CaretRightIcon size={16} weight="bold" />
            </Button>
          </article>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-xl border p-5 sm:p-6"
          aria-labelledby="energy-title"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LightningIcon size={20} weight="fill" />
              </span>
              <div>
                <h2 id="energy-title" className="font-semibold">
                  Energy delivered
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Daily analytics grouped by session start hour
                </p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                {totalEnergyToday.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}{" "}
                <span className="text-sm font-medium text-muted-foreground">
                  kWh
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Energy delivered today
              </p>
            </div>
          </div>
          <ChartContainer
            config={energyChartConfig}
            className="mt-5 h-56 w-full"
          >
            <AreaChart
              data={hourlyEnergy}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="dailyEnergyFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--color-kwh)"
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-kwh)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                interval={5}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value) => [`${value} kWh`, "Energy delivered"]}
                  />
                }
              />
              <Area
                type="monotone"
                isAnimationActive={false}
                dataKey="kwh"
                stroke="var(--color-kwh)"
                strokeWidth={2.5}
                fill="url(#dailyEnergyFill)"
                activeDot={{ r: 4, fill: "var(--color-kwh)" }}
              />
            </AreaChart>
          </ChartContainer>
        </section>

        <section
          className="rounded-xl border p-5 sm:p-6"
          aria-labelledby="live-power-title"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LightningIcon size={20} weight="fill" />
            </span>
            <div>
              <h2 id="live-power-title" className="font-semibold">
                Live charging power
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Total active session power (kW) over the last 30 seconds
              </p>
            </div>
          </div>
          <ChartContainer
            config={powerChartConfig}
            className="mt-5 h-56 w-full"
          >
            <AreaChart
              data={powerChartData}
              margin={{ top: 10, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="livePowerFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-powerKw)"
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-powerKw)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={[powerEnd - POWER_WINDOW_MS, powerEnd]}
                hide
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={56}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(value: number) => Number(value).toFixed(0)}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `Time: ${formatPowerTime(label)}`}
                    formatter={(value) => [
                      `${Number(value).toFixed(2)} kW`,
                      "Charging power",
                    ]}
                  />
                }
              />
              <Area
                type="linear"
                isAnimationActive={false}
                dataKey="powerKw"
                stroke="var(--color-powerKw)"
                strokeWidth={2.5}
                fill="url(#livePowerFill)"
                activeDot={{ r: 4, fill: "var(--color-powerKw)" }}
              />
            </AreaChart>
          </ChartContainer>
        </section>
      </div>
    </main>
  );
}
