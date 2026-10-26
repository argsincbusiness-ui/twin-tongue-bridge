import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStudioUsage } from "@/lib/studio.functions";
import { summarizeStudioUsage, type StudioUsageRow } from "@/lib/studio/schema";

export function StudioUsage({ emailOf }: { emailOf: (id: string) => string }) {
  const read = useServerFn(getStudioUsage);
  const [rows, setRows] = useState<StudioUsageRow[]>([]);
  const [daily, setDaily] = useState(true);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setBusy(true); setError(null);
    try { setRows(await read()); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Studio usage</h2>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={daily} onChange={e => setDaily(e.target.checked)} /> Per day (South Africa)</label>
        <Button variant="outline" size="sm" disabled={busy} onClick={load}><RefreshCw className={busy ? "animate-spin" : ""} /> Refresh</Button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {busy ? <p role="status" className="text-sm text-muted-foreground">Loading Studio usage…</p> : <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-border"><th className="p-2">User</th><th className="p-2">Day</th><th className="p-2">Generations</th><th className="p-2">Characters</th></tr></thead>
          <tbody>{summarizeStudioUsage(rows, daily).map(group => <tr key={`${group.userId}/${group.day}`} className="border-b border-border">
            <td className="break-all p-2">{emailOf(group.userId)}</td><td className="whitespace-nowrap p-2">{group.day}</td><td className="p-2">{group.generations.toLocaleString()}</td><td className="p-2">{group.characters.toLocaleString()}</td>
          </tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="py-4 text-sm text-muted-foreground">No Studio generations recorded yet.</p>}
      </div>
      {rows.length > 0 && <details>
        <summary className="cursor-pointer text-xs font-medium">Generation log</summary>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs">
          <thead><tr className="border-b border-border">{["User", "Date / time (South Africa)", "Tool", "Language", "Characters", "Kind"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row, i) => <tr key={i} className="border-b border-border"><td className="break-all p-2">{emailOf(row.user_id)}</td><td className="whitespace-nowrap p-2">{new Date(row.created_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</td><td className="p-2">{row.tool}</td><td className="p-2">{row.language}</td><td className="p-2">{row.character_count.toLocaleString()}</td><td className="p-2">{row.generation_kind}</td></tr>)}</tbody>
        </table></div>
      </details>}
    </>}
  </section>;
}