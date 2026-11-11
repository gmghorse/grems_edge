import {useState} from "react";
import {CheckIcon, FloppyDiskIcon, HardDrivesIcon, PaintBrushIcon, WifiHighIcon} from "@phosphor-icons/react";
import {PageHeader, SectionTitle} from "@/components/PageHeader";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Input} from "@headlessui/react";
import {useChargerModelStore} from "@/store/charger-model-store";

const ToggleRow = ({title, detail, checked, onChange}: {title: string; detail: string; checked: boolean; onChange: (value: boolean) => void}) => <div className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><Switch checked={checked} onCheckedChange={onChange}/></div>;
export default function Settings() {
    const [saved, setSaved] = useState(false);
    const [darkTheme, setDarkTheme] = useState(() => document.documentElement.classList.contains("dark"));
    const models = useChargerModelStore(state => state.models);
    const addModel = useChargerModelStore(state => state.addModel);
    const [modelName, setModelName] = useState("");
    const updateTheme = (enabled: boolean) => {
        document.documentElement.classList.toggle("dark", enabled);
        localStorage.setItem("grems-edge-theme", enabled ? "dark" : "light");
        setDarkTheme(enabled);
        setSaved(false);
    };
    const saveModel = () => {
        const value = modelName.trim();
        if (!value || models.some(model => model.toLowerCase() === value.toLowerCase())) return;
        addModel(value);
        setModelName("");
        setSaved(false);
    };

    return <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
        <PageHeader eyebrow="Edge server" title="Settings" description="Configure this station and its local edge server." action={<Button onClick={() => setSaved(true)}><FloppyDiskIcon/> Save changes</Button>}/>
        {saved && <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary"><CheckIcon/> Settings saved for this session.</div>}
        <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-xl border p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><WifiHighIcon size={20}/></span><SectionTitle title="Station details" detail="Identity shown across the dashboard"/></div>
                <div className="mt-5 space-y-4">
                    <div><p className="text-sm font-medium">Station name</p><p className="mt-1 text-sm text-muted-foreground">Grems Demonstration Station</p></div>
                    <div><p className="text-sm font-medium">Station ID</p><p className="mt-1 font-mono text-sm text-muted-foreground">GR-ST-001</p></div>
                    <div><p className="text-sm font-medium">Location</p><p className="mt-1 text-sm text-muted-foreground">Lagos, Nigeria</p></div>
                </div>
            </article>
            <article className="rounded-xl border p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><HardDrivesIcon size={20}/></span><SectionTitle title="Edge server" detail="Local network and service health"/></div>
                <div className="mt-5 divide-y text-sm">
                    <div className="flex justify-between py-3"><span className="text-muted-foreground">Server status</span><span className="inline-flex items-center gap-2 font-medium text-primary"><span className="size-2 rounded-full bg-primary"/>Online</span></div>
                    <div className="flex justify-between py-3"><span className="text-muted-foreground">Software version</span><span className="font-mono">1.0.0</span></div>
                    <div className="flex justify-between py-3"><span className="text-muted-foreground">Last sync</span><span>Just now</span></div>
                    <div className="flex justify-between py-3"><span className="text-muted-foreground">Network</span><span>Ethernet · Connected</span></div>
                    <div className="flex flex-wrap justify-between gap-2 py-3"><span className="text-muted-foreground">OCPP listener</span><span className="font-mono">All interfaces · port 9000</span></div>
                </div>
            </article>
            <article className="rounded-xl border p-5 sm:p-6">
                <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><PaintBrushIcon size={20}/></span><SectionTitle title="Appearance" detail="Choose how the dashboard looks"/></div>
                <div className="mt-4 divide-y"><ToggleRow title="Dark theme" detail="Use the dark color scheme throughout the app." checked={darkTheme} onChange={updateTheme}/></div>
            </article>
            <article className="rounded-xl border p-5 sm:p-6">
                <SectionTitle title="Charger models" detail="Models available when adding a charger"/>
                <ul className="mt-4 space-y-2 text-sm">{models.map(model => <li key={model} className="rounded-lg bg-muted/50 px-3 py-2">{model}</li>)}</ul>
                <div className="mt-4 flex gap-2">
                    <Input aria-label="New charger model" className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="e.g. GREMS AC 22 kW" value={modelName} onChange={event => setModelName(event.target.value)} onKeyDown={event => {if (event.key === "Enter") {event.preventDefault(); saveModel();}}}/>
                    <Button variant="outline" onClick={saveModel} disabled={!modelName.trim()}>Add model</Button>
                </div>
            </article>
        </section>
    </main>;
}
