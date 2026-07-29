import { useMemo, useState } from "react";
import { Building2, Search, Server, TicketPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClientsBoard({ clients = [], machines = [], onCreateTicket }) {
  const [query, setQuery] = useState("");
  const visibleClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clients;
    return clients.filter((client) => [client.nom, client.name, client.email, client.ville].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [clients, query]);

  return <div className="space-y-5 p-5 md:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a6b46]">Parc client</p><h2 className="mt-1 text-3xl font-black text-[#2d1b12]">Clients</h2><p className="mt-1 text-sm text-[#7a5f4b]">Accéder au parc installé et ouvrir un ticket SAV avec le client déjà renseigné.</p></div>
      <div className="flex h-11 min-w-[280px] items-center gap-2 rounded-2xl border border-[#d8c4ad] bg-white px-4 shadow-sm"><Search className="h-4 w-4 text-[#9a8571]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client..." className="w-full bg-transparent text-sm outline-none" /></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visibleClients.map((client) => {
        const clientMachines = machines.filter((machine) => String(machine.clientId || "") === String(client.id || ""));
        const clientName = client.nom || client.name || "Client sans nom";
        return <Card key={client.id} className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div className="rounded-2xl bg-[#f0dfcd] p-3"><Building2 className="h-5 w-5 text-[#5b351f]" /></div><span className="rounded-full border border-[#d8c4ad] bg-white px-3 py-1 text-xs font-bold text-[#7a5f4b]">{clientMachines.length} machine{clientMachines.length > 1 ? "s" : ""}</span></div><CardTitle className="pt-3 text-xl text-[#2d1b12]">{clientName}</CardTitle><p className="text-sm text-[#7a5f4b]">{client.ville || client.adresse || "Coordonnées à compléter"}</p></CardHeader><CardContent className="space-y-4"><div className="space-y-2">{clientMachines.slice(0, 3).map((machine) => <div key={machine.id} className="flex items-center gap-2 rounded-2xl border border-[#eadcc9] bg-white px-3 py-2 text-sm text-[#5b351f]"><Server className="h-4 w-4" /><span className="font-semibold">{machine.code || machine.numero || machine.numeroInterne || machine.id}</span><span className="truncate text-[#7a5f4b]">{machine.marque} {machine.modele}</span></div>)}{!clientMachines.length ? <div className="rounded-2xl border border-dashed border-[#d8c4ad] px-3 py-4 text-center text-xs text-[#9a8571]">Aucune machine affectée</div> : null}</div><Button type="button" onClick={() => onCreateTicket?.({ clientId: client.id, clientName, machineId: "", machineCode: "" })} className="w-full rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"><TicketPlus className="mr-2 h-4 w-4" />Créer un ticket SAV</Button></CardContent></Card>;
      })}
    </div>
    {!visibleClients.length ? <div className="rounded-3xl border border-dashed border-[#d8c4ad] bg-white/70 p-10 text-center text-sm text-[#7a5f4b]">Aucun client trouvé.</div> : null}
  </div>;
}
