import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  Plus,
  Search,
  TicketCheck,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "lpb-machines-sav-tickets-v1";

const COLUMNS = [
  { key: "NOUVEAU", label: "Nouveau", icon: CircleDot },
  { key: "DIAGNOSTIC", label: "Diagnostic", icon: ClipboardList },
  { key: "PIECES", label: "Attente pièces", icon: Clock3 },
  { key: "PLANIFIE", label: "Planifié", icon: CalendarClock },
  { key: "EN_COURS", label: "En cours", icon: Wrench },
  { key: "CLOTURE", label: "Clôturé", icon: CheckCircle2 },
];

const PRIORITIES = ["BASSE", "NORMALE", "HAUTE", "CRITIQUE"];

function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function priorityClasses(priority) {
  if (priority === "CRITIQUE") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "HAUTE") return "border-orange-200 bg-orange-50 text-orange-700";
  if (priority === "BASSE") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function nextStatus(status) {
  const index = COLUMNS.findIndex((column) => column.key === status);
  return COLUMNS[Math.min(index + 1, COLUMNS.length - 1)]?.key || status;
}

function getClientKey(client) {
  return String(client?.crmClientId || client?.id || client?.pennylaneCustomerId || "");
}

function machineBelongsToClient(machine, client) {
  if (!machine || !client) return false;

  const machineClientIds = [
    machine.clientId,
    machine.crmClientId,
    machine.pennylaneCustomerId,
  ]
    .filter(Boolean)
    .map(String);

  const clientIds = [
    client.id,
    client.crmClientId,
    client.pennylaneCustomerId,
  ]
    .filter(Boolean)
    .map(String);

  return machineClientIds.some((value) => clientIds.includes(value));
}

export default function TicketsBoard({ clients = [], machines = [], initialContext = null, onInitialContextConsumed }) {
  const [tickets, setTickets] = useState(loadTickets);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(Boolean(initialContext));
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [form, setForm] = useState(() => ({
    title: "",
    machineCode: initialContext?.machineCode || "",
    clientName: initialContext?.clientName || "",
    priority: "NORMALE",
    description: "",
    technician: "",
    machineId: initialContext?.machineId || "",
    clientId: initialContext?.clientId || "",
    desiredDate: "",
  }));

  function closeForm() {
    setShowForm(false);
    onInitialContextConsumed?.();
  }

  function selectMachine(machineId) {
    const machine = machines.find((item) => String(item.id) === String(machineId));
    if (!machine) {
      setForm((current) => ({ ...current, machineId: "", machineCode: "" }));
      return;
    }
    const machineCode = machine.code || machine.numero || machine.numeroInterne || machine.id;
    const client = clients.find((item) => machineBelongsToClient(machine, item));
    setForm((current) => ({
      ...current,
      machineId: machine.id,
      machineCode: String(machineCode || ""),
      clientId: client ? getClientKey(client) : current.clientId || "",
      clientName: client?.nom || client?.name || current.clientName || "",
    }));
  }

  function selectClient(clientId) {
    const client = clients.find((item) => getClientKey(item) === String(clientId));
    const selectedMachine = machines.find((item) => String(item.id) === String(form.machineId));
    const keepMachine = selectedMachine && client && machineBelongsToClient(selectedMachine, client);
    setForm((current) => ({
      ...current,
      clientId: client ? getClientKey(client) : "",
      clientName: client?.nom || client?.name || "",
      machineId: keepMachine ? current.machineId : "",
      machineCode: keepMachine ? current.machineCode : "",
    }));
  }

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tickets;
    return tickets.filter((ticket) =>
      [ticket.reference, ticket.title, ticket.machineCode, ticket.clientName, ticket.technician]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [tickets, query]);

  const metrics = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status !== "CLOTURE").length,
      critical: tickets.filter((ticket) => ticket.priority === "CRITIQUE" && ticket.status !== "CLOTURE").length,
      active: tickets.filter((ticket) => ticket.status === "EN_COURS").length,
      planned: tickets.filter((ticket) => ticket.status === "PLANIFIE").length,
    }),
    [tickets],
  );

  function updateTickets(updater) {
    setTickets((current) => {
      const updated = typeof updater === "function" ? updater(current) : updater;
      saveTickets(updated);
      return updated;
    });
  }

  function createTicket(event) {
    event.preventDefault();
    if (!form.title.trim()) return;

    const now = new Date();
    const ticket = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      reference: `SAV-${now.getFullYear()}-${String(tickets.length + 1).padStart(4, "0")}`,
      title: form.title.trim(),
      machineId: form.machineId || null,
      machineCode: form.machineCode.trim(),
      clientId: form.clientId || null,
      clientName: form.clientName.trim(),
      priority: form.priority,
      description: form.description.trim(),
      technician: form.technician.trim(),
      desiredDate: form.desiredDate || null,
      status: "NOUVEAU",
      createdAt: now.toISOString(),
    };

    updateTickets((current) => [ticket, ...current]);
    setForm({ title: "", machineCode: "", clientName: "", priority: "NORMALE", description: "", technician: "", machineId: "", clientId: "", desiredDate: "" });
    setShowForm(false);
    onInitialContextConsumed?.();
    setSelectedTicket(ticket);
  }

  function moveTicket(ticketId, status) {
    updateTickets((current) => current.map((ticket) => (ticket.id === ticketId ? { ...ticket, status } : ticket)));
    setSelectedTicket((current) => (current?.id === ticketId ? { ...current, status } : current));
  }

  function deleteTicket(ticketId) {
    if (!window.confirm("Supprimer définitivement ce ticket SAV ?")) return;
    updateTickets((current) => current.filter((ticket) => ticket.id !== ticketId));
    setSelectedTicket(null);
  }

  return (
    <div className="space-y-5 p-5 md:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a6b46]">Exécution technique</p>
          <h2 className="mt-1 text-3xl font-black text-[#2d1b12]">Tickets SAV</h2>
          <p className="mt-1 text-sm text-[#7a5f4b]">Qualifier, diagnostiquer et suivre chaque incident technique sans empiéter sur le CRM.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex h-11 min-w-[280px] items-center gap-2 rounded-2xl border border-[#d8c4ad] bg-white px-4 shadow-sm">
            <Search className="h-4 w-4 text-[#9a8571]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Référence, machine, client..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <Button onClick={() => setShowForm(true)} className="h-11 rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]">
            <Plus className="mr-2 h-4 w-4" /> Nouveau ticket
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Tickets ouverts" value={metrics.open} icon={TicketCheck} />
        <Metric title="Critiques" value={metrics.critical} icon={AlertTriangle} danger />
        <Metric title="En cours" value={metrics.active} icon={Wrench} />
        <Metric title="Planifiés" value={metrics.planned} icon={CalendarClock} />
      </div>

      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1500px] grid-cols-6 gap-3">
          {COLUMNS.map(({ key, label, icon: Icon }) => {
            const columnTickets = filteredTickets.filter((ticket) => ticket.status === key);
            return (
              <section key={key} className="rounded-3xl border border-[#d8c4ad] bg-[#fffaf3] p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 font-bold text-[#2d1b12]">
                    <Icon className="h-4 w-4 text-[#9a6b46]" /> {label}
                  </div>
                  <Badge variant="outline" className="border-[#d8c4ad]">{columnTickets.length}</Badge>
                </div>
                <div className="space-y-3">
                  {columnTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className="w-full rounded-2xl border border-[#eadcc9] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#9a6b46] hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[#9a8571]">{ticket.reference}</span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${priorityClasses(ticket.priority)}`}>{ticket.priority}</span>
                      </div>
                      <h3 className="mt-2 font-extrabold text-[#2d1b12]">{ticket.title}</h3>
                      <div className="mt-3 space-y-1 text-xs text-[#7a5f4b]">
                        <div>{ticket.machineCode || "Machine non renseignée"}</div>
                        <div>{ticket.clientName || "Client non renseigné"}</div>
                        {ticket.technician ? <div className="flex items-center gap-1"><UserRound className="h-3 w-3" /> {ticket.technician}</div> : null}
                      </div>
                      {key !== "CLOTURE" ? (
                        <div className="mt-4 flex items-center justify-end text-xs font-bold text-[#5b351f]">
                          Étape suivante <ChevronRight className="ml-1 h-3 w-3" />
                        </div>
                      ) : null}
                    </button>
                  ))}
                  {!columnTickets.length ? (
                    <div className="rounded-2xl border border-dashed border-[#d8c4ad] px-3 py-8 text-center text-xs text-[#9a8571]">Aucun ticket</div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {showForm ? (
        <Modal title="Créer un ticket SAV" onClose={closeForm}>
          <form className="space-y-4" onSubmit={createTicket}>
            <Field label="Objet du ticket *"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Machine">
                <select value={form.machineId} onChange={(event) => selectMachine(event.target.value)} className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm">
                  <option value="">Sélectionner une machine</option>
                  {machines.filter((machine) => {
                    if (!form.clientId) return true;
                    const selectedClient = clients.find((client) => getClientKey(client) === String(form.clientId));
                    return machineBelongsToClient(machine, selectedClient);
                  }).map((machine) => {
                    const code = machine.code || machine.numero || machine.numeroInterne || machine.id;
                    return <option key={machine.id} value={machine.id}>{code} · {machine.marque} {machine.modele}</option>;
                  })}
                </select>
              </Field>
              <Field label="Client (CRM / Pennylane)">
                <select value={form.clientId} onChange={(event) => selectClient(event.target.value)} className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm">
                  <option value="">Sélectionner un client</option>
                  {clients.map((client) => (
                    <option key={getClientKey(client)} value={getClientKey(client)}>
                      {client.nom || client.name}{client.pennylaneCustomerId ? " · Pennylane" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priorité">
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm">
                  {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </Field>
              <Field label="Technicien"><Input value={form.technician} onChange={(event) => setForm({ ...form, technician: event.target.value })} /></Field>
              <Field label="Date souhaitée"><Input type="date" value={form.desiredDate} onChange={(event) => setForm({ ...form, desiredDate: event.target.value })} /></Field>
            </div>
            <Field label="Description technique"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={5} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm} className="rounded-2xl">Annuler</Button>
              <Button type="submit" className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]">Créer le ticket</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {selectedTicket ? (
        <Modal title={selectedTicket.reference} onClose={() => setSelectedTicket(null)}>
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-[#2d1b12]">{selectedTicket.title}</h3>
                <span className={`rounded-full border px-2 py-1 text-xs font-bold ${priorityClasses(selectedTicket.priority)}`}>{selectedTicket.priority}</span>
              </div>
              <p className="mt-2 text-sm text-[#7a5f4b]">{selectedTicket.description || "Aucune description technique."}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Machine" value={selectedTicket.machineCode || "Non renseignée"} />
              <Info label="Client" value={selectedTicket.clientName || "Non renseigné"} />
              <Info label="Technicien" value={selectedTicket.technician || "Non affecté"} />
              <Info label="Statut" value={COLUMNS.find((column) => column.key === selectedTicket.status)?.label || selectedTicket.status} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-[#eadcc9] pt-4">
              <Button type="button" variant="outline" className="rounded-2xl border-red-200 text-red-700" onClick={() => deleteTicket(selectedTicket.id)}>Supprimer</Button>
              {selectedTicket.status !== "CLOTURE" ? (
                <Button type="button" className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]" onClick={() => moveTicket(selectedTicket.id, nextStatus(selectedTicket.status))}>
                  Passer à l’étape suivante <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Metric({ title, value, icon: Icon, danger = false }) {
  return (
    <Card className="rounded-3xl border-[#d8c4ad] bg-white shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div><p className="text-xs text-[#7a5f4b]">{title}</p><p className={`mt-1 text-3xl font-black ${danger ? "text-red-700" : "text-[#2d1b12]"}`}>{value}</p></div>
        <div className={`rounded-2xl p-3 ${danger ? "bg-red-50" : "bg-[#f0dfcd]"}`}><Icon className={`h-5 w-5 ${danger ? "text-red-700" : "text-[#5b351f]"}`} /></div>
      </CardContent>
    </Card>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#eadcc9]">
          <CardTitle className="text-xl text-[#2d1b12]">{title}</CardTitle>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-[#f0dfcd]"><X className="h-5 w-5" /></button>
        </CardHeader>
        <CardContent className="p-6">{children}</CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold text-[#5b351f]">{label}</span>{children}</label>;
}

function Info({ label, value }) {
  return <div className="rounded-2xl border border-[#eadcc9] bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-[#9a8571]">{label}</div><div className="mt-1 font-semibold text-[#2d1b12]">{value}</div></div>;
}
