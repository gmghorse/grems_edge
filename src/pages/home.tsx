import {Link} from "react-router";
import {
    CaretRightIcon,
    ChargingStationIcon,
    CheckCircleIcon,
    LightningIcon,
    WarningCircleIcon
} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button";
import {type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent} from "@/components/ui/chart";
import {Area, AreaChart, CartesianGrid, XAxis} from "recharts";

const issues = false;

const hourlyEnergy = [
    {time: "00:00", kwh: 38}, {time: "02:00", kwh: 28}, {time: "04:00", kwh: 43},
    {time: "06:00", kwh: 72}, {time: "08:00", kwh: 94}, {time: "10:00", kwh: 128},
    {time: "12:00", kwh: 110}, {time: "14:00", kwh: 146}, {time: "16:00", kwh: 135},
    {time: "18:00", kwh: 168}, {time: "20:00", kwh: 142}, {time: "Now", kwh: 104},
];

const energyChartConfig = {
    kwh: {label: "Energy delivered", color: "var(--primary)"},
} satisfies ChartConfig;

const chargerStates = [
    {
        label: "Charging",
        count: "08",
        detail: "Delivering power",
        icon: ChargingStationIcon,
        className: "home-state-charging",
    },
    {
        label: "Ready",
        count: "13",
        detail: "Connected and available",
        icon: ChargingStationIcon,
        className: "home-state-ready",
    },
    {
        label: "Disconnected",
        count: "03",
        detail: "Not reporting to the edge server",
        icon: ChargingStationIcon,
        className: "home-state-offline",
    },
];

export default function Home() {
    return (
        <main className="home-dashboard mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
            <header className="flex flex-col justify-between gap-4 font-display sm:flex-row sm:items-end">
                <div>
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        <span className="size-2 rounded-full bg-primary"/> Station edge server
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Charger overview</h1>
                    <p className="mt-2 text-sm text-muted-foreground">A quick view of charger status at this
                        station.</p>
                </div>
                <Link to="/chargers"
                      className="home-text-link inline-flex items-center gap-1 text-sm font-medium text-primary">
                    View all chargers <CaretRightIcon size={16} weight="bold"/>
                </Link>
            </header>

            <section aria-label="Charger status" className="flex flex-row gap-8 flex-wrap">
                {chargerStates.map((state) => {
                    const Icon = state.icon;
                    return (

                        <article key={state.label}
                                 className={`home-state-card ${state.className} w-64 rounded-xl border p-5 sm:p-6`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{state.label}</p>
                                    <p className="mt-4 font-mono text-5xl font-semibold tracking-tight tabular-nums">{state.count}</p>
                                </div>
                                <span
                                    className="home-state-icon flex size-10 items-center justify-center rounded-xl">
                                    <Icon size={20} weight="fill"
                                          color={state.label == "Disconnected" ? "#e77400" : state.label == "Charging" ? "#cdb832" : "#32cd32"}
                                    />
                                </span>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">{state.detail}</p>
                        </article>
                    );
                })}
            </section>

            {
                issues ? (<section>
                    <article
                        className="border-warning flex flex-col justify-between gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:p-6">
                        <div className="flex items-start gap-4">
                        <span
                            className="flex size-11 shrink-0 items-center justify-center rounded-xl">
                            <WarningCircleIcon size={22} weight="fill" color={"#e77400"}/>
                        </span>
                            <div>
                                <h2 className="font-semibold">3 chargers need attention</h2>
                                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                                    These chargers are disconnected from the edge server. Check their connection status
                                    and
                                    details.
                                </p>
                            </div>
                        </div>
                        <Button render={<Link to="/chargers"/>} variant="outline" className="shrink-0">
                            Review chargers <CaretRightIcon size={16} weight="bold"/>
                        </Button>
                    </article>
                </section>) : (<section>
                    <article
                        className=" border-primary flex flex-col justify-between gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:p-6">
                        <div className="flex items-start gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl">
        <CheckCircleIcon size={22} weight="fill" color={"#32cd32"}/>

      </span>
                            <div>
                                <h2 className="font-semibold">All chargers are operational</h2>
                                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                                    All chargers are connected to the edge server and operating normally. No issues
                                    require your attention.
                                </p>
                            </div>
                        </div>
                        <Button render={<Link to="/chargers"/>} variant="outline" className="shrink-0">
                            View chargers <CaretRightIcon size={16} weight="bold"/>
                        </Button>
                    </article>
                </section>)
            }


            <section className="rounded-xl border p-5 sm:p-6" aria-labelledby="energy-title">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="flex items-start gap-3">
                        <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <LightningIcon size={20} weight="fill"/>
                        </span>
                        <div>
                            <h2 id="energy-title" className="font-semibold">Energy delivered</h2>
                            <p className="mt-1 text-xs text-muted-foreground">Station charger output throughout
                                today</p>
                        </div>
                    </div>
                    <div className="sm:text-right">
                        <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">1,284.6 <span
                            className="text-sm font-medium text-muted-foreground">kWh</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">Today so far</p>
                    </div>
                </div>
                <ChartContainer config={energyChartConfig} className="mt-5 h-56 w-full">
                    <AreaChart data={hourlyEnergy} margin={{top: 10, right: 8, left: 0, bottom: 0}}>
                        <defs>
                            <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-kwh)" stopOpacity={0.24}/>
                                <stop offset="100%" stopColor="var(--color-kwh)" stopOpacity={0.01}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4"/>
                        <XAxis
                            dataKey="time"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                            tick={{fill: "var(--muted-foreground)", fontSize: 11}}
                            tickFormatter={(value) => ["00:00", "06:00", "12:00", "18:00", "Now"].includes(value) ? value : ""}
                        />
                        <ChartTooltip
                            cursor={{stroke: "var(--border)", strokeDasharray: "4 4"}}
                            content={<ChartTooltipContent labelFormatter={(label) => `Time: ${label}`}
                                                          formatter={(value) => [`${value} kWh`, "Energy delivered"]}/>}
                        />
                        <Area type="monotone" dataKey="kwh" stroke="var(--color-kwh)" strokeWidth={2.5}
                              fill="url(#energyFill)" activeDot={{r: 4, fill: "var(--color-kwh)"}}/>
                    </AreaChart>
                </ChartContainer>
            </section>
        </main>
    );
}
