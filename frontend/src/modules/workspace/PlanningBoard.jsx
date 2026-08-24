import React, { useEffect, useMemo, useState } from "react";

 

import {

  AlertTriangle,

  CalendarDays,

  ChevronLeft,

  ChevronRight,

  Clock3,

  MapPin,

  RefreshCw,

  UserRound,

  Wrench,

} from "lucide-react";

 

import {

  Card,

  CardContent,

  CardHeader,

  CardTitle,

} from "@/components/ui/card";

 

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

 

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || "change-me";

 

const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

const START_HOUR = 8;

const END_HOUR = 18;

const HOUR_HEIGHT = 72;

const MIN_EVENT_HEIGHT = 42;

 

function startOfWeek(date) {

  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  const day = result.getDay();

  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);

  return result;

}

 

function addDays(date, days) {

  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;

}

 

function formatDay(date) {

  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

}

 

function formatLongDate(date) {

  return date.toLocaleDateString("fr-FR", {

    day: "numeric",

    month: "long",

    year: "numeric",

  });

}

 

function formatHour(value) {

  if (!value) return "--:--";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "--:--";

  return parsed.toLocaleTimeString("fr-FR", {

    hour: "2-digit",

    minute: "2-digit",

  });

}

 

function formatDateTime(value) {

  if (!value) return "Non renseigné";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Non renseigné";

  return parsed.toLocaleString("fr-FR", {

    weekday: "long",

    day: "2-digit",

    month: "2-digit",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",

  });

}

 

function sameDay(first, second) {

  if (!first || !second) return false;

  return (

    first.getFullYear() === second.getFullYear() &&

    first.getMonth() === second.getMonth() &&

    first.getDate() === second.getDate()

  );

}

 

function normalizePlanningEntry(entry) {

  return {

    ...entry,

    scheduledStart: entry.scheduledStart || entry.startsAt || null,

    scheduledEnd: entry.scheduledEnd || entry.endsAt || null,

    ticketReference: entry.ticketReference || null,

    ticketTitle: entry.ticketTitle || entry.title || null,

    interventionType: entry.interventionType || "REPARATION",

    status: entry.status || "PLANIFIEE",

    ticketPriority: entry.ticketPriority || "NORMALE",

    technician: entry.technician || "Technicien non affecté",

  };

}

 

function statusLabel(status) {

  const labels = {

    A_PLANIFIER: "À planifier",

    PLANIFIEE: "Planifiée",

    EN_ROUTE: "En route",

    EN_COURS: "En cours",

    TERMINEE: "Terminée",

    ANNULEE: "Annulée",

  };

  return labels[status] || status || "-";

}

 

function typeLabel(type) {

  const labels = {

    DIAGNOSTIC: "Diagnostic",

    REPARATION: "Réparation",

    INSTALLATION: "Installation",

    MAINTENANCE_PREVENTIVE: "Maintenance préventive",

    DEPANNAGE: "Dépannage",

    RETRAIT: "Retrait",

    LIVRAISON: "Livraison",

    AUTRE: "Autre",

  };

  return labels[type] || type || "Intervention";

}

 

function priorityLabel(priority) {

  const labels = {

    URGENTE: "Urgente",

    CRITIQUE: "Critique",

    HAUTE: "Haute",

    NORMALE: "Normale",

    BASSE: "Basse",

  };

  return labels[priority] || priority || "Normale";

}

 

function priorityClasses(priority) {

  switch (String(priority || "").toUpperCase()) {

    case "URGENTE":

    case "CRITIQUE":

      return "border-red-300 bg-red-50 text-red-800";

    case "HAUTE":

      return "border-orange-300 bg-orange-50 text-orange-800";

    case "BASSE":

      return "border-slate-200 bg-slate-50 text-slate-700";

    default:

      return "border-amber-200 bg-amber-50 text-amber-800";

  }

}

 

async function planningApiFetch(path) {

  const response = await fetch(`${API_BASE_URL}${path}`, {

    headers: {

      Accept: "application/json",

      "x-api-key": ADMIN_API_KEY,

    },

  });

 

  const raw = await response.text();

  let payload = null;

 

  if (raw) {

    try {

      payload = JSON.parse(raw);

    } catch {

      payload = raw;

    }

  }

 

  if (!response.ok) {

    throw new Error(

      payload?.message || payload?.error || `Erreur API ${response.status}`,

    );

  }

 

  return payload;

}

 

async function loadTechnicians() {

  return planningApiFetch("/sav/technicians");

}

 

function minutesFromMidnight(date) {

  return date.getHours() * 60 + date.getMinutes();

}

 

function eventPosition(entry) {

  const start = new Date(entry.scheduledStart);

  const end = new Date(entry.scheduledEnd || entry.scheduledStart);

  const visibleStartMinutes = START_HOUR * 60;

  const visibleEndMinutes = END_HOUR * 60;

 

  const rawStart = minutesFromMidnight(start);

  const rawEnd = Math.max(minutesFromMidnight(end), rawStart + 30);

 

  const clippedStart = Math.max(rawStart, visibleStartMinutes);

  const clippedEnd = Math.min(rawEnd, visibleEndMinutes);

 

  if (clippedEnd <= visibleStartMinutes || clippedStart >= visibleEndMinutes) {

    return null;

  }

 

  return {

    top: ((clippedStart - visibleStartMinutes) / 60) * HOUR_HEIGHT,

    height: Math.max(

      ((clippedEnd - clippedStart) / 60) * HOUR_HEIGHT,

      MIN_EVENT_HEIGHT,

    ),

  };

}

 

function overlaps(first, second) {

  const firstStart = new Date(first.scheduledStart).getTime();

  const firstEnd = new Date(first.scheduledEnd || first.scheduledStart).getTime();

  const secondStart = new Date(second.scheduledStart).getTime();

  const secondEnd = new Date(second.scheduledEnd || second.scheduledStart).getTime();

  return firstStart < secondEnd && firstEnd > secondStart;

}

 

function addConflictFlags(entries) {

  return entries.map((entry, index) => {

    const hasConflict = entries.some((other, otherIndex) => {

      if (index === otherIndex) return false;

      if (!entry.technicianId || !other.technicianId) return false;

      if (String(entry.technicianId) !== String(other.technicianId)) return false;

      return overlaps(entry, other);

    });

    return { ...entry, hasConflict };

  });

}

 

function AgendaEvent({ intervention, onClick }) {

  const position = eventPosition(intervention);

  if (!position) return null;

 

  return (

    <button

      type="button"

      onClick={() => onClick(intervention)}

      className={`absolute left-1 right-1 overflow-hidden rounded-xl border bg-white px-2 py-1.5 text-left shadow-sm transition hover:z-30 hover:border-[#5b351f] hover:shadow-md ${

        intervention.hasConflict

          ? "z-20 border-red-400 ring-2 ring-red-200"

          : "z-10 border-[#d8c4ad]"

      }`}

      style={{

        top: `${position.top}px`,

        height: `${position.height}px`,

      }}

      title={`${formatHour(intervention.scheduledStart)} - ${formatHour(

        intervention.scheduledEnd,

      )} · ${intervention.clientName || "Client"}`}

    >

      <div className="flex items-start justify-between gap-1">

        <div className="min-w-0 text-[11px] font-black text-[#2d1b12]">

          {formatHour(intervention.scheduledStart)} - {formatHour(intervention.scheduledEnd)}

        </div>

        {intervention.hasConflict ? (

          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" />

        ) : null}

      </div>

 

      <div className="mt-0.5 truncate text-xs font-black text-[#5b351f]">

        {intervention.clientName || "Client non renseigné"}

      </div>

 

      <div className="mt-0.5 truncate text-[11px] text-[#7a5f4b]">

        {intervention.machineCode || "Machine non renseignée"}

      </div>

 

      <div className="mt-0.5 truncate text-[11px] font-semibold text-[#2d1b12]">

        {intervention.technician || "Technicien non affecté"}

      </div>

 

      {position.height >= 68 ? (

        <div className="mt-1 flex items-center justify-between gap-1">

          <span className="truncate text-[10px] text-[#7a5f4b]">

            {intervention.ticketReference || typeLabel(intervention.interventionType)}

          </span>

          <Badge

            variant="outline"

            className={`h-5 px-1.5 text-[9px] ${priorityClasses(

              intervention.ticketPriority,

            )}`}

          >

            {priorityLabel(intervention.ticketPriority)}

          </Badge>

        </div>

      ) : null}

    </button>

  );

}

 

function InterventionCard({ intervention, onClick }) {

  return (

    <button

      type="button"

      onClick={() => onClick(intervention)}

      className="w-full rounded-2xl border border-[#e4d4c2] bg-white p-3 text-left shadow-sm transition hover:border-[#5b351f] hover:bg-[#fffaf3]"

    >

      <div className="flex items-start justify-between gap-2">

        <div className="min-w-0">

          <div className="truncate text-sm font-bold text-[#5b351f]">

            {intervention.clientName || "Client non renseigné"}

          </div>

          <div className="mt-1 text-xs text-[#7a5f4b]">

            {intervention.ticketReference || "Ticket SAV"}

          </div>

        </div>

        <Badge

          variant="outline"

          className={priorityClasses(intervention.ticketPriority)}

        >

          {priorityLabel(intervention.ticketPriority)}

        </Badge>

      </div>

 

      <div className="mt-3 space-y-1 text-xs text-[#7a5f4b]">

        <div>{intervention.machineCode || "Machine non renseignée"}</div>

        <div className="flex items-center gap-1">

          <UserRound className="h-3.5 w-3.5" />

          {intervention.technician || "Technicien non affecté"}

        </div>

      </div>

    </button>

  );

}

 

function InterventionDetail({ intervention, onClose }) {

  if (!intervention) return null;

 

  return (

    <div

      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"

      onMouseDown={onClose}

    >

      <Card

        className="w-full max-w-2xl rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-2xl"

        onMouseDown={(event) => event.stopPropagation()}

      >

        <CardHeader>

          <div className="flex items-start justify-between gap-4">

            <div>

              <CardTitle className="text-2xl text-[#2d1b12]">

                {intervention.ticketReference || "Intervention SAV"}

              </CardTitle>

              <p className="mt-1 text-sm text-[#7a5f4b]">

                {intervention.ticketTitle || typeLabel(intervention.interventionType)}

              </p>

            </div>

            <Button

              type="button"

              variant="outline"

              onClick={onClose}

              className="rounded-2xl"

            >

              Fermer

            </Button>

          </div>

        </CardHeader>

 

        <CardContent className="space-y-5">

          {intervention.hasConflict ? (

            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">

              <AlertTriangle className="h-5 w-5" />

              Conflit horaire détecté pour ce technicien.

            </div>

          ) : null}

 

          <div className="grid gap-4 md:grid-cols-2">

            <DetailItem label="Client" value={intervention.clientName || "Non renseigné"} icon={UserRound} />

            <DetailItem label="Machine" value={intervention.machineCode || "Non renseignée"} icon={Wrench} />

            <DetailItem label="Technicien" value={intervention.technician || "Non affecté"} icon={UserRound} />

            <DetailItem label="Statut" value={statusLabel(intervention.status)} icon={RefreshCw} />

            <DetailItem label="Début" value={formatDateTime(intervention.scheduledStart)} icon={CalendarDays} />

            <DetailItem label="Fin" value={formatDateTime(intervention.scheduledEnd)} icon={Clock3} />

            <DetailItem label="Lieu" value={intervention.locationLabel || intervention.locationType || "Non renseigné"} icon={MapPin} />

            <DetailItem label="Google Agenda" value={intervention.googleEventId ? "Synchronisé" : "Non synchronisé"} icon={CalendarDays} />

          </div>

        </CardContent>

      </Card>

    </div>

  );

}

 

function DetailItem({ label, value, icon: Icon }) {

  return (

    <div className="rounded-2xl border border-[#e4d4c2] bg-white p-4">

      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#7a5f4b]">

        <Icon className="h-4 w-4" />

        {label}

      </div>

      <div className="mt-2 text-sm font-bold text-[#2d1b12]">{value}</div>

    </div>

  );

}

 

function StatBox({ title, value, subtitle }) {

  return (

    <div className="rounded-3xl border border-[#e4d4c2] bg-white p-5 shadow-sm">

      <div className="text-sm font-bold text-[#7a5f4b]">{title}</div>

      <div className="mt-2 text-3xl font-black text-[#2d1b12]">{value}</div>

      <div className="mt-1 text-xs text-[#9a8571]">{subtitle}</div>

    </div>

  );

}

 

export default function PlanningBoard() {

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const [interventions, setInterventions] = useState([]);

  const [unscheduled, setUnscheduled] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [selectedIntervention, setSelectedIntervention] = useState(null);

  const [technicians, setTechnicians] = useState([]);

  const [technicianFilter, setTechnicianFilter] = useState("ALL");

 

  const weekDays = useMemo(

    () => Array.from({ length: 5 }, (_, index) => addDays(weekStart, index)),

    [weekStart],

  );

 

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const today = new Date();

  const agendaHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  const hours = useMemo(

    () => Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index),

    [],

  );

 

  async function loadPlanning() {

    try {

      setLoading(true);

      setError("");

 

      const params = new URLSearchParams();

      params.set("from", weekStart.toISOString());

      params.set("to", weekEnd.toISOString());

      if (technicianFilter !== "ALL") {

        params.set("technician", technicianFilter);

      }

 

      const [planningRows, unscheduledRows] = await Promise.all([

        planningApiFetch(`/sav/planning?${params.toString()}`),

        planningApiFetch("/sav/interventions?status=A_PLANIFIER"),

      ]);

 

      const normalizedPlanning = Array.isArray(planningRows)

        ? planningRows.map(normalizePlanningEntry)

        : [];

 

      setInterventions(addConflictFlags(normalizedPlanning));

 

      const normalizedUnscheduled = Array.isArray(unscheduledRows)

        ? unscheduledRows

            .map(normalizePlanningEntry)

            .filter((item) => !item.scheduledStart)

            .filter(

              (item) =>

                technicianFilter === "ALL" ||

                String(item.technicianId || "") === String(technicianFilter),

            )

        : [];

 

      setUnscheduled(normalizedUnscheduled);

    } catch (loadError) {

      console.error("PLANNING LOAD ERROR", loadError);

      setError(loadError?.message || "Impossible de charger le planning SAV.");

      setInterventions([]);

      setUnscheduled([]);

    } finally {

      setLoading(false);

    }

  }

 

  useEffect(() => {

    loadPlanning();

  }, [weekStart, technicianFilter]);

 

  useEffect(() => {

    loadTechnicians()

      .then((rows) => setTechnicians(Array.isArray(rows) ? rows : []))

      .catch((loadError) => {

        console.error("PLANNING TECHNICIANS ERROR", loadError);

        setTechnicians([]);

      });

  }, []);

 

  const todayCount = interventions.filter(

    (intervention) =>

      intervention.scheduledStart &&

      sameDay(new Date(intervention.scheduledStart), today),

  ).length;

 

  const conflictCount = interventions.filter((item) => item.hasConflict).length;

 

  return (

    <>

      <div className="space-y-6 p-5 md:p-8">

        <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">

          <CardHeader>

            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex items-start gap-4">

                <div className="rounded-2xl bg-[#f0dfcd] p-3">

                  <CalendarDays className="h-6 w-6 text-[#5b351f]" />

                </div>

                <div>

                  <CardTitle className="text-2xl text-[#2d1b12]">Planning SAV</CardTitle>

                  <p className="mt-1 text-sm text-[#7a5f4b]">

                    Agenda des interventions, disponibilités et affectations techniciens.

                  </p>

                </div>

              </div>

 

              <div className="flex flex-wrap items-center gap-2">

                <Button

                  type="button"

                  variant="outline"

                  className="rounded-2xl border-[#d8c4ad] bg-white text-[#5b351f]"

                  onClick={() => setWeekStart(addDays(weekStart, -7))}

                >

                  <ChevronLeft className="mr-1 h-4 w-4" />

                  Précédente

                </Button>

 

                <Button

                  type="button"

                  variant="outline"

                  className="rounded-2xl border-[#d8c4ad] bg-white text-[#5b351f]"

                  onClick={() => setWeekStart(startOfWeek(new Date()))}

                >

                  Aujourd'hui

                </Button>

 

                <Button

                  type="button"

                  variant="outline"

                  className="rounded-2xl border-[#d8c4ad] bg-white text-[#5b351f]"

                  onClick={() => setWeekStart(addDays(weekStart, 7))}

                >

                  Suivante

                  <ChevronRight className="ml-1 h-4 w-4" />

                </Button>

 

                <Button

                  type="button"

                  className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"

                  onClick={loadPlanning}

                  disabled={loading}

                >

                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />

                  Actualiser

                </Button>

              </div>

            </div>

          </CardHeader>

 

          <CardContent>

            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e4d4c2] bg-white p-4 md:flex-row md:items-center md:justify-between">

              <div>

                <div className="text-sm font-black text-[#2d1b12]">Vue du planning</div>

                <div className="mt-1 text-xs text-[#7a5f4b]">

                  Tous les techniciens pour le Manager ou planning individuel.

                </div>

              </div>

 

              <select

                value={technicianFilter}

                onChange={(event) => setTechnicianFilter(event.target.value)}

                className="h-11 min-w-[280px] rounded-2xl border border-[#d8c4ad] bg-[#fffdf8] px-4 text-sm font-semibold text-[#5b351f]"

              >

                <option value="ALL">Tous les techniciens - Vue Manager</option>

                {technicians.map((technician) => (

                  <option key={technician.id} value={technician.id}>

                    {technician.displayName}

                  </option>

                ))}

              </select>

            </div>

 

            <div className="mb-5 text-lg font-black text-[#2d1b12]">

              Semaine du {formatLongDate(weekStart)} au {formatLongDate(addDays(weekStart, 4))}

            </div>

 

            <div className="grid gap-4 md:grid-cols-4">

              <StatBox title="Aujourd'hui" value={todayCount} subtitle="Interventions prévues" />

              <StatBox title="Cette semaine" value={interventions.length} subtitle="Créneaux planifiés" />

              <StatBox title="À planifier" value={unscheduled.length} subtitle="Sans créneau horaire" />

              <StatBox title="Conflits" value={conflictCount} subtitle="Chevauchements détectés" />

            </div>

          </CardContent>

        </Card>

 

        {error ? (

          <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">

            <CardContent className="p-4 text-sm font-medium text-red-700">{error}</CardContent>

          </Card>

        ) : null}

 

        <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">

          <CardContent className="p-4 md:p-5">

            {loading ? (

              <div className="flex min-h-[500px] items-center justify-center text-sm text-[#7a5f4b]">

                Chargement du planning...

              </div>

            ) : (

              <div className="overflow-x-auto">

                <div className="min-w-[1180px]">

                  <div className="grid grid-cols-[72px_repeat(5,minmax(0,1fr))] gap-0">

                    <div className="border-b border-r border-[#e4d4c2] bg-[#fffaf3]" />

                    {weekDays.map((day, dayIndex) => {

                      const isToday = sameDay(day, today);

                      return (

                        <div

                          key={day.toISOString()}

                          className={`border-b border-r border-[#e4d4c2] px-3 py-3 text-center ${

                            isToday ? "bg-[#f8ecdf]" : "bg-white"

                          }`}

                        >

                          <div className="text-xs font-black uppercase tracking-wide text-[#5b351f]">

                            {DAY_NAMES[dayIndex]}

                          </div>

                          <div className="mt-1 text-lg font-black text-[#2d1b12]">{formatDay(day)}</div>

                        </div>

                      );

                    })}

 

                    <div className="relative border-r border-[#e4d4c2] bg-[#fffdf8]" style={{ height: `${agendaHeight}px` }}>

                      {hours.map((hour) => (

                        <div

                          key={hour}

                          className="absolute left-0 right-0 -translate-y-1/2 pr-2 text-right text-[11px] font-semibold text-[#9a8571]"

                          style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}

                        >

                          {String(hour).padStart(2, "0")}:00

                        </div>

                      ))}

                    </div>

 

                    {weekDays.map((day) => {

                      const dayItems = addConflictFlags(

                        interventions

                          .filter(

                            (intervention) =>

                              intervention.scheduledStart &&

                              sameDay(new Date(intervention.scheduledStart), day),

                          )

                          .sort(

                            (first, second) =>

                              new Date(first.scheduledStart) - new Date(second.scheduledStart),

                          ),

                      );

 

                      return (

                        <div

                          key={`agenda-${day.toISOString()}`}

                          className="relative border-r border-[#e4d4c2] bg-white"

                          style={{

                            height: `${agendaHeight}px`,

                            backgroundImage:

                              "repeating-linear-gradient(to bottom, transparent 0, transparent 35px, #f3e8dc 36px, transparent 37px, transparent 71px, #e4d4c2 72px)",

                          }}

                        >

                          {dayItems.map((intervention) => (

                            <AgendaEvent

                              key={intervention.id}

                              intervention={intervention}

                              onClick={setSelectedIntervention}

                            />

                          ))}

                        </div>

                      );

                    })}

                  </div>

                </div>

              </div>

            )}

          </CardContent>

        </Card>

 

        {unscheduled.length > 0 ? (

          <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">

            <CardHeader>

              <CardTitle className="text-xl text-[#2d1b12]">À planifier</CardTitle>

              <p className="text-sm text-[#7a5f4b]">Interventions créées sans date ni heure.</p>

            </CardHeader>

            <CardContent>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

                {unscheduled.map((intervention) => (

                  <InterventionCard

                    key={intervention.id}

                    intervention={intervention}

                    onClick={setSelectedIntervention}

                  />

                ))}

              </div>

            </CardContent>

          </Card>

        ) : null}

      </div>

 

      <InterventionDetail

        intervention={selectedIntervention}

        onClose={() => setSelectedIntervention(null)}

      />

    </>

  );

}