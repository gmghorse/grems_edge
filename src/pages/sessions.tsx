import {useState} from "react";
import {DownloadSimpleIcon, LightningIcon, InfoIcon} from "@phosphor-icons/react";
import {PageHeader, MetricCard, SectionTitle} from "@/components/PageHeader";
import {Button} from "@/components/ui/button";
import {Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle} from "@/components/ui/drawer";

type Session = {id:string; charger:string; time:string; duration:string; energy:string; power:string; cost:string; status:string};
const sessions:Session[]=[{id:"SES-2841",charger:"GR-001 · North entrance",time:"Today, 10:42 AM",duration:"48 min",energy:"18.6 kWh",power:"—",cost:"₦2,790",status:"Completed"},{id:"SES-2840",charger:"GR-003 · Fleet bay 01",time:"Today, 10:16 AM",duration:"32 min",energy:"26.4 kWh",power:"42.8 kW",cost:"₦3,960",status:"Active"},{id:"SES-2839",charger:"GR-002 · Visitor parking",time:"Today, 9:28 AM",duration:"1 hr 12 min",energy:"31.2 kWh",power:"—",cost:"₦4,680",status:"Completed"},{id:"SES-2838",charger:"GR-005 · South entrance",time:"Today, 8:51 AM",duration:"56 min",energy:"14.8 kWh",power:"—",cost:"₦2,220",status:"Completed"}];

export default function Sessions(){
  const [tab,setTab]=useState("All sessions");
  const [selectedSession,setSelectedSession]=useState<Session|null>(null);
  const rows=sessions.filter(s=>tab==="All sessions"||(tab==="Active"?s.status==="Active":s.status==="Completed"));
  const openInfo=(session:Session)=>setSelectedSession(session);
  const closeInfo=()=>setSelectedSession(null);

  return <main className="mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
    <PageHeader eyebrow="Charging activity" title="Sessions" description="Review charging activity and energy delivered." action={<Button variant="outline"><DownloadSimpleIcon/> Export report</Button>}/>
    <section className="grid gap-4 sm:grid-cols-3"><MetricCard label="Sessions today" value="42" detail="Across all chargers"/><MetricCard label="Energy delivered" value="1,284" detail="kWh delivered today"/><MetricCard label="Active now" value="08" detail="Currently charging"/></section>
    <section className="rounded-xl border p-5 sm:p-6"><SectionTitle title="Recent sessions" detail="Live and completed charging records"/>
      <div className="mt-5 flex gap-2">{["All sessions","Active","Completed"].map(t=><Button key={t} size="sm" variant={tab===t?"default":"outline"} onClick={()=>setTab(t)}>{t}</Button>)}</div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="py-3 font-medium">CHARGER</th><th className="py-3 font-medium">DURATION</th><th className="py-3 font-medium">ENERGY</th><th className="py-3 font-medium">POWER</th><th className="py-3 font-medium">COST</th><th className="py-3 font-medium">STATUS</th><th><span className="sr-only">Info</span></th></tr></thead><tbody>{rows.map(s=><tr key={s.id} className="border-b last:border-0"><td className="py-4"><p className="font-medium">{s.charger.split(" · ")[0]}</p><p className="mt-0.5 text-xs text-muted-foreground">{s.time}</p></td><td className="py-4">{s.duration}</td><td className="py-4 font-mono tabular-nums">{s.energy}</td><td className="py-4"><span className="inline-flex items-center gap-2 font-mono tabular-nums">{s.status==="Active"&&<span className="size-2 animate-pulse rounded-full bg-primary"/>}{s.power}</span>{s.status==="Active"&&<span className="ml-2 text-xs text-primary">Live</span>}</td><td className="py-4 font-mono tabular-nums">{s.cost}</td><td className="py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.status==="Active"?"bg-primary/10 text-primary":"bg-muted text-muted-foreground"}`}><LightningIcon/>{s.status}</span></td><td className="py-4 text-right"><Button variant="outline" size="sm" onClick={()=>openInfo(s)}><InfoIcon/> Info</Button></td></tr>)}</tbody></table></div>
    </section>
    <Drawer open={selectedSession!==null} onOpenChange={open=>{if(!open)closeInfo();}} swipeDirection="right">
      <DrawerContent className="w-[min(92vw,28rem)] border-l bg-background">
        {selectedSession&&<div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="px-6 pt-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Charging session info</p><DrawerTitle className="mt-2 text-xl">{selectedSession.charger.split(" · ")[0]}</DrawerTitle><DrawerDescription>{selectedSession.charger}</DrawerDescription></DrawerHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-2 gap-3">{[["Session ID",selectedSession.id],["Started",selectedSession.time],["Duration",selectedSession.duration],["Energy delivered",selectedSession.energy],["Power",selectedSession.power],["Current cost",selectedSession.cost],["Status",selectedSession.status]].map(([label,value])=><div key={label} className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>)}</div>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{selectedSession.status==="Active"?"Power shows the latest reading available for this session.":"This charging session has ended."}</p>
          </div>
          <DrawerFooter className="flex-row justify-end border-t px-6 py-4"><DrawerClose render={<Button type="button" variant="outline"/>}>Close</DrawerClose></DrawerFooter>
        </div>}
      </DrawerContent>
    </Drawer>
  </main>
}
