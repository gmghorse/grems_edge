import {useMemo, useState} from "react";
import {ChargingStationIcon, PlusIcon, SlidersHorizontalIcon} from "@phosphor-icons/react";
import {Fieldset, Input} from "@headlessui/react";
import {MetricCard, PageHeader, SectionTitle} from "@/components/PageHeader";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle} from "@/components/ui/drawer";

type Charger = {id: string; name: string; model: string; status: string; power: string; since: string};
type ChargerSettings = {name: string; location: string; maxCurrent: string; enabled: boolean; faultAlerts: boolean};

const initialChargers: Charger[] = [
    {
        id: "GR-001",
        name: "Charger 1",
        model: "GREMS AC · Dual port",
        status: "Charging",
        power: "11.2 kW",
        since: "Connected 2 min ago"
    },
    {
        id: "GR-002",
        name: "Charger 2",
        model: "GREMS AC · Dual port",
        status: "Ready",
        power: "—",
        since: "Available now"
    },
    {
        id: "GR-003",
        name: "Charger 3",
        model: "GREMS DC · 60 kW",
        status: "Charging",
        power: "42.8 kW",
        since: "Connected 18 min ago"
    },
    {
        id: "GR-004",
        name: "Charger 4",
        model: "GREMS DC · 60 kW",
        status: "Disconnected",
        power: "—",
        since: "Last seen 24 min ago"
    },
    {
        id: "GR-005",
        name: "Charger 5",
        model: "GREMS AC · Dual port",
        status: "Ready",
        power: "—",
        since: "Available now"
    },
];
const stateClass: Record<string, string> = {
    Charging: "bg-primary/10 text-primary",
    Ready: "bg-muted text-muted-foreground",
    Disconnected: "bg-orange-500/10 text-orange-600"
};
export default function Chargers() {
    const [chargers, setChargers] = useState(initialChargers);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("All");
    const [selectedCharger, setSelectedCharger] = useState<Charger | null>(null);
    const [settings, setSettings] = useState<Record<string, ChargerSettings>>({});
    const [draft, setDraft] = useState<ChargerSettings | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newModel, setNewModel] = useState("GREMS AC · Dual port");
    const [newMaxCurrent, setNewMaxCurrent] = useState("32");
    const visible = useMemo(() => chargers.filter(c => (filter === "All" || c.status === filter) && `${c.id} ${c.name} ${c.status}`.toLowerCase().includes(query.toLowerCase())), [filter, query]);
    const openSettings = (charger: Charger) => {
        setSelectedCharger(charger);
        setDraft(settings[charger.id] ?? {name: charger.name, location: "", maxCurrent: charger.model.includes("DC") ? "125" : "32", enabled: true, faultAlerts: true});
    };
    const closeSettings = () => setSelectedCharger(null);
    const saveSettings = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedCharger || !draft) return;
        setSettings(current => ({...current, [selectedCharger.id]: draft}));
        setChargers(current => current.map(charger => charger.id === selectedCharger.id ? {...charger, name: draft.name} : charger));
        closeSettings();
    };
    const nextChargerId = `GR-${String(Math.max(0, ...chargers.map(charger => Number(charger.id.replace("GR-", "")))) + 1).padStart(3, "0")}`;
    const addCharger = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = newName.trim();
        if (!name) return;
        const charger: Charger = {id: nextChargerId, name, model: newModel, status: "Disconnected", power: "—", since: "Not yet connected"};
        setChargers(current => [...current, charger]);
        setSettings(current => ({...current, [charger.id]: {name, location: "", maxCurrent: newMaxCurrent, enabled: true, faultAlerts: true}}));
        setFilter("All");
        setQuery("");
        setAddOpen(false);
        setNewName("");
    };
    return <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
        <PageHeader eyebrow="Station equipment" title="Chargers"
                    description="Monitor charger availability and connection health." action={
                                                                                           <Button
                                                                                              className={"text-black"}
                                                                                              onClick={() => {setNewName(""); setNewModel("GREMS AC · Dual port"); setNewMaxCurrent("32"); setAddOpen(true);}}>
                                                                                              <PlusIcon/> Add
                                                                                              charger
                                                                                          </Button>}/>
        <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Total chargers" value={String(chargers.length)} detail="Across this station"/>
            <MetricCard label="Available" value="13" detail="Ready for a new session"/>
            <MetricCard label="Needs attention" value="03" detail="Disconnected from the edge server"
                        tone="border-orange-500/30"/>
        </section>
        <section className="rounded-xl border p-5 sm:p-6"><SectionTitle title="All chargers"
                                                                        detail={`${visible.length} of 24 chargers`}/>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                {/*<Fieldset className="relative flex-1">*/}
                {/*    <Input*/}
                {/*        aria-label="Search chargers"*/}
                {/*        className="block w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm/6 text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring pl-9"*/}
                {/*        placeholder="Search chargers" value={query}*/}
                {/*        onChange={e => setQuery(e.target.value)}/>*/}
                {/*</Fieldset>*/}
                <div className="flex gap-2">
                    {["All", "Charging", "Ready", "Disconnected"].map(f => <Button key={f} size="sm"
                                                                                   variant={filter === f ? "default" : "outline"}
                                                                                   onClick={() => setFilter(f)}>
                        {f}
                    </Button>)}
                </div>
            </div>
            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                        <th className="py-3 font-medium">CHARGER</th>
                        <th className="py-3 font-medium">STATUS</th>
                        <th className="py-3 font-medium">OUTPUT</th>
                        <th className="py-3 font-medium">CONNECTION</th>
                        <th className="py-3 font-medium"><span className="sr-only">Settings</span></th>
                    </tr>
                    </thead>
                    <tbody>{visible.map(c => <tr key={c.id} className="border-b last:border-0">
                        <td className="py-4">
                            <div className="flex items-center gap-3"><span
                                className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ChargingStationIcon
                                size={18}/></span>
                                <div><p className="font-medium">{c.name}</p><p
                                    className="mt-0.5 text-xs text-muted-foreground">{c.id} · {c.model}</p></div>
                            </div>
                        </td>
                        <td className="py-4"><span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${stateClass[c.status]}`}>{c.status}</span>
                        </td>
                        <td className="py-4 font-mono tabular-nums">{c.power}</td>
                        <td className="py-4 text-muted-foreground">{c.since}</td>
                        <td className="py-4 text-right"><Button variant="outline" size="sm" onClick={() => openSettings(c)}><SlidersHorizontalIcon/> Settings</Button></td>
                    </tr>)}</tbody>
                </table>
                {visible.length === 0 &&
                    <p className="py-10 text-center text-sm text-muted-foreground">No chargers match this search.</p>}
            </div>
        </section>
        <Drawer open={selectedCharger !== null} onOpenChange={open => {if (!open) closeSettings();}} swipeDirection="right">
            <DrawerContent className="w-[min(92vw,28rem)] border-l bg-background">
                {selectedCharger && draft && <form className="flex h-full min-h-0 flex-col" onSubmit={saveSettings}>
                    <DrawerHeader className="px-6 pt-7">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Charger configuration</p>
                        <DrawerTitle className="mt-2 text-xl">{selectedCharger.name}</DrawerTitle>
                        <DrawerDescription>{selectedCharger.id} · {selectedCharger.model}</DrawerDescription>
                    </DrawerHeader>
                    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                        <Fieldset className="space-y-4">
                            <label className="block text-sm font-medium">Charger name<Input className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring" value={draft.name} onChange={event => setDraft({...draft, name: event.target.value})}/></label>
                            <label className="block text-sm font-medium">Location<Input className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring" placeholder="Add a location" value={draft.location} onChange={event => setDraft({...draft, location: event.target.value})}/></label>
                            <label className="block text-sm font-medium">Maximum current (A)<Input type="number" min="1" className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring" value={draft.maxCurrent} onChange={event => setDraft({...draft, maxCurrent: event.target.value})}/></label>
                        </Fieldset>
                        <div className="divide-y rounded-xl border px-4">
                            <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Charger enabled</p><p className="mt-1 text-xs text-muted-foreground">Allow this charger to accept new sessions.</p></div><Switch checked={draft.enabled} onCheckedChange={enabled => setDraft({...draft, enabled})}/></div>
                            <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">Fault notifications</p><p className="mt-1 text-xs text-muted-foreground">Show an alert when this charger reports a fault.</p></div><Switch checked={draft.faultAlerts} onCheckedChange={faultAlerts => setDraft({...draft, faultAlerts})}/></div>
                        </div>
                        <div className="rounded-xl bg-muted/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current status</p><p className="mt-2 text-sm font-medium">{selectedCharger.status}</p><p className="mt-1 text-xs text-muted-foreground">{selectedCharger.since}</p></div>
                    </div>
                    <DrawerFooter className="flex-row justify-end border-t px-6 py-4">
                        <DrawerClose render={<Button type="button" variant="outline" onClick={closeSettings}/>}>Cancel</DrawerClose>
                        <Button type="submit">Save settings</Button>
                    </DrawerFooter>
                </form>}
            </DrawerContent>
        </Drawer>
        <Drawer open={addOpen} onOpenChange={setAddOpen} swipeDirection="right">
            <DrawerContent className="w-[min(92vw,28rem)] border-l bg-background">
                <form className="flex h-full min-h-0 flex-col" onSubmit={addCharger}>
                    <DrawerHeader className="px-6 pt-7">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Station equipment</p>
                        <DrawerTitle className="mt-2 text-xl">Add a charger</DrawerTitle>
                        <DrawerDescription>Enter the charger details to add it to this station.</DrawerDescription>
                    </DrawerHeader>
                    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                        <Fieldset className="space-y-4">
                            <label className="block text-sm font-medium">Charger name<Input autoFocus required className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring" placeholder="e.g. West parking bay" value={newName} onChange={event => setNewName(event.target.value)}/></label>
                            <label className="block text-sm font-medium">Charger ID<Input readOnly className="mt-2 block w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground" value={nextChargerId}/></label>
                            <label className="block text-sm font-medium">Charger model<select className="mt-2 block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newModel} onChange={event => {const model=event.target.value;setNewModel(model);setNewMaxCurrent(model.includes("DC")?"125":"32");}}><option>GREMS AC · Dual port</option><option>GREMS DC · 60 kW</option></select></label>
                            <label className="block text-sm font-medium">Maximum current (A)<Input type="number" min="1" required className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring" value={newMaxCurrent} onChange={event => setNewMaxCurrent(event.target.value)}/></label>
                        </Fieldset>
                        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">The charger will appear as disconnected until it reports to the edge server.</p>
                    </div>
                    <DrawerFooter className="flex-row justify-end border-t px-6 py-4">
                        <DrawerClose render={<Button type="button" variant="outline"/>}>Cancel</DrawerClose>
                        <Button type="submit"><PlusIcon/> Add charger</Button>
                    </DrawerFooter>
                </form>
            </DrawerContent>
        </Drawer>
    </main>
}
