import type {ReactNode} from "react";

export function PageHeader({eyebrow, title, description, action}: {eyebrow: string; title: string; description: string; action?: ReactNode}) {
  return <header className="flex flex-col justify-between gap-4 font-display sm:flex-row sm:items-end">
    <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><span className="size-2 rounded-full bg-primary"/>{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>
    {action}
  </header>
}

export function MetricCard({label, value, detail, tone = ""}: {label: string; value: string; detail: string; tone?: string}) {
  return <article className={`w-full rounded-xl border p-5 sm:p-6 ${tone}`}><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-3 font-mono text-4xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></article>
}

export function SectionTitle({title, detail, action}: {title: string; detail?: string; action?: ReactNode}) {
  return <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">{title}</h2>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>{action}</div>
}
