import {useMemo, useState} from "react";
import {KeyIcon, PlusIcon, ShieldCheckIcon, SlidersHorizontalIcon} from "@phosphor-icons/react";
import {PageHeader, MetricCard, SectionTitle} from "@/components/PageHeader";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle} from "@/components/ui/drawer";
import type {Credential, CredentialDraft} from "@/types/credential";
import {useCredentialStore} from "@/store/credential-store";

const inputClass = "mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-ring";
const displayStatus = (credential: Credential) => credential.status;

export default function Access() {
    const credentials = useCredentialStore(state => state.credentials);
    const addCredential = useCredentialStore(state => state.addCredential);
    const updateCredential = useCredentialStore(state => state.updateCredential);
    const [tab, setTab] = useState("All credentials");
    const [drawerMode, setDrawerMode] = useState<"add" | "manage" | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<CredentialDraft | null>(null);

    const selectedCredential = credentials.find(credential => credential.id === selectedId) ?? null;
    const rows = useMemo(() => credentials.filter(credential => {
        const status = displayStatus(credential);
        return tab === "All credentials" || status === tab;
    }), [credentials, tab]);
    const activeCount = credentials.filter(credential => displayStatus(credential) === "Active").length;
    const usedTodayCount = credentials.filter(credential => credential.lastUsed.startsWith("Today")).length;
    const revokedCount = credentials.filter(credential => credential.status === "Revoked").length;

    const openAdd = () => {
        setSelectedId(null);
        setDraft({name: "", credentialId: "", assigned: "", active: true});
        setDrawerMode("add");
    };
    const openManage = (credential: Credential) => {
        setSelectedId(credential.id);
        setDraft({name: credential.name, credentialId: credential.id, assigned: credential.assigned, active: credential.status === "Active"});
        setDrawerMode("manage");
    };
    const closeDrawer = () => {
        setDrawerMode(null);
        setSelectedId(null);
        setDraft(null);
    };
    const saveCredential = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!draft) return;
        const credentialId = draft.credentialId.trim();
        const name = draft.name.trim();
        if (!credentialId || !name) return;

        if (drawerMode === "add") {
            if (credentials.some(credential => credential.id.toLowerCase() === credentialId.toLowerCase())) return;
            addCredential({
                id: credentialId,
                name,
                assigned: draft.assigned.trim() || "Unassigned",
                lastUsed: "Never",
                status: draft.active ? "Active" : "Revoked",
            });
        } else if (selectedCredential) {
            if (credentials.some(credential => credential.id !== selectedCredential.id && credential.id.toLowerCase() === credentialId.toLowerCase())) return;
            updateCredential(selectedCredential.id, {
                id: credentialId,
                name,
                assigned: draft.assigned.trim() || "Unassigned",
                status: draft.active ? "Active" : "Revoked",
            });
        }
        closeDrawer();
    };

    return <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
        <PageHeader eyebrow="Station permissions" title="Access" description="Manage the credentials that can start a charging session." action={<Button onClick={openAdd}><PlusIcon/> Add credential</Button>}/>
        <section className="grid gap-4 sm:grid-cols-3">
            <MetricCard label="Total credentials" value={String(credentials.length)} detail="Registered at this station"/>
            <MetricCard label="Used today" value={String(usedTodayCount)} detail="Credentials used today"/>
            <MetricCard label="Active credentials" value={String(activeCount)} detail={`${revokedCount} revoked`}/>
        </section>
        <section className="rounded-xl border p-5 sm:p-6">
            <div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheckIcon size={20}/></span><SectionTitle title="Credential management" detail="Control who can charge at this station"/></div>
            <div className="mt-5 flex gap-2">{["All credentials", "Active", "Revoked"].map(filter => <Button key={filter} size="sm" variant={tab === filter ? "default" : "outline"} onClick={() => setTab(filter)}>{filter}</Button>)}</div>
            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="py-3 font-medium">CREDENTIAL</th><th className="py-3 font-medium">ASSIGNED TO</th><th className="py-3 font-medium">LAST USED</th><th className="py-3 font-medium">STATUS</th><th><span className="sr-only">Manage</span></th></tr></thead>
                    <tbody>{rows.map(credential => {
                        const status = displayStatus(credential);
                        return <tr key={credential.id} className="border-b last:border-0">
                            <td className="py-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><KeyIcon size={17}/></span><div><p className="font-medium">{credential.name}</p><p className="mt-0.5 text-xs text-muted-foreground">RFID card · •••• {credential.id.slice(-4)}</p></div></div></td>
                            <td className="py-4">{credential.assigned}</td><td className="py-4 text-muted-foreground">{credential.lastUsed}</td>
                            <td className="py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status === "Active" ? "bg-primary/10 text-primary" : status === "Revoked" ? "bg-muted text-muted-foreground" : "bg-orange-500/10 text-orange-600"}`}>{status}</span></td>
                            <td className="py-4 text-right"><Button variant="outline" size="sm" onClick={() => openManage(credential)}><SlidersHorizontalIcon/> Manage</Button></td>
                        </tr>;
                    })}</tbody>
                </table>
                {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No credentials in this view.</p>}
            </div>
        </section>

        <Drawer open={drawerMode !== null} onOpenChange={open => {if (!open) closeDrawer();}} swipeDirection="right">
            <DrawerContent className="w-[min(92vw,28rem)] border-l bg-background">
                {drawerMode && draft && <form className="flex h-full min-h-0 flex-col" onSubmit={saveCredential}>
                    <DrawerHeader className="px-6 pt-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Station permissions</p><DrawerTitle className="mt-2 text-xl">{drawerMode === "add" ? "Add credential" : "Manage credential"}</DrawerTitle><DrawerDescription>{drawerMode === "add" ? "Add an RFID card credential." : selectedCredential?.name}</DrawerDescription></DrawerHeader>
                    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                        <label className="block text-sm font-medium">Credential name<input required className={inputClass} placeholder="e.g. Facilities team" value={draft.name} onChange={event => setDraft({...draft, name: event.target.value})}/></label>
                        <label className="block text-sm font-medium">Credential ID<input required className={inputClass} placeholder="Scan or enter the credential ID" value={draft.credentialId} onChange={event => setDraft({...draft, credentialId: event.target.value})}/></label>
                        <label className="block text-sm font-medium">Assigned to<input className={inputClass} placeholder="Person, team, or visitor" value={draft.assigned} onChange={event => setDraft({...draft, assigned: event.target.value})}/></label>
                        <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-4"><div><p className="text-sm font-medium">Credential active</p><p className="mt-1 text-xs text-muted-foreground">Allow this credential to start charging sessions.</p></div><Switch checked={draft.active} onCheckedChange={active => setDraft({...draft, active})}/></div>
                    </div>
                    <DrawerFooter className="flex-row justify-end border-t px-6 py-4"><DrawerClose render={<Button type="button" variant="outline"/>}>Cancel</DrawerClose><Button type="submit">{drawerMode === "add" ? "Add credential" : "Save changes"}</Button></DrawerFooter>
                </form>}
            </DrawerContent>
        </Drawer>
    </main>;
}
