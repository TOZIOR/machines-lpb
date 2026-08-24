import React, {

  useEffect,

  useMemo,

  useState,

} from "react";

 

import {

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

 

const API_BASE_URL =

  import.meta.env.VITE_API_BASE_URL ||

  "/api";

 

const ADMIN_API_KEY =

  import.meta.env.VITE_ADMIN_API_KEY ||

  "change-me";

 

const DAY_NAMES = [

  "Lundi",

  "Mardi",

  "Mercredi",

  "Jeudi",

  "Vendredi",

];

 

function startOfWeek(date) {

  const result = new Date(date);

 

  result.setHours(0, 0, 0, 0);

 

  const day = result.getDay();

 

  const difference =

    day === 0

      ? -6

      : 1 - day;

 

  result.setDate(

    result.getDate() + difference,

  );

 

  return result;

}

 

function addDays(date, days) {

  const result = new Date(date);

 

  result.setDate(

    result.getDate() + days,

  );

 

  return result;

}

 

function toApiDateTime(date) {

  return date.toISOString();

}

 

function formatDay(date) {

  return date.toLocaleDateString(

    "fr-FR",

    {

      day: "2-digit",

      month: "2-digit",

    },

  );

}

 

function formatLongDate(date) {

  return date.toLocaleDateString(

    "fr-FR",

    {

      day: "numeric",

      month: "long",

      year: "numeric",

    },

  );

}

 

function formatHour(value) {

  if (!value) return "--:--";

 

  const parsed =

    new Date(value);

 

  if (

    Number.isNaN(

      parsed.getTime(),

    )

  ) {

    return "--:--";

  }

 

  return parsed.toLocaleTimeString(

    "fr-FR",

    {

      hour: "2-digit",

      minute: "2-digit",

    },

  );

}

 

function sameDay(

  first,

  second,

) {

  if (

    !first ||

    !second

  ) {

    return false;

  }

 

  return (

    first.getFullYear() ===

      second.getFullYear() &&

    first.getMonth() ===

      second.getMonth() &&

    first.getDate() ===

      second.getDate()

  );

}

 

function statusLabel(status) {

  const labels = {

    A_PLANIFIER:

      "À planifier",

 

    PLANIFIEE:

      "Planifiée",

 

    EN_ROUTE:

      "En route",

 

    EN_COURS:

      "En cours",

 

    TERMINEE:

      "Terminée",

 

    ANNULEE:

      "Annulée",

  };

 

  return (

    labels[status] ||

    status ||

    "-"

  );

}

 

function typeLabel(type) {

  const labels = {

    DIAGNOSTIC:

      "Diagnostic",

 

    REPARATION:

      "Réparation",

 

    INSTALLATION:

      "Installation",

 

    MAINTENANCE_PREVENTIVE:

      "Maintenance préventive",

 

    DEPANNAGE:

      "Dépannage",

 

    RETRAIT:

      "Retrait",

 

    LIVRAISON:

      "Livraison",

 

    AUTRE:

      "Autre",

  };

 

  return (

    labels[type] ||

    type ||

    "Intervention"

  );

}

 

function priorityLabel(

  priority,

) {

  const labels = {

    URGENTE: "Urgente",

    HAUTE: "Haute",

    NORMALE: "Normale",

    BASSE: "Basse",

  };

 

  return (

    labels[priority] ||

    priority ||

    "Normale"

  );

}

 

function priorityClasses(

  priority,

) {

  switch (

    String(

      priority || "",

    ).toUpperCase()

  ) {

    case "URGENTE":

      return "border-red-300 bg-red-50 text-red-800";

 

    case "HAUTE":

      return "border-orange-300 bg-orange-50 text-orange-800";

 

    case "BASSE":

      return "border-slate-200 bg-slate-50 text-slate-700";

 

    default:

      return "border-amber-200 bg-amber-50 text-amber-800";

  }

}

 

async function planningApiFetch(

  path,

) {

  const response =

    await fetch(

      `${API_BASE_URL}${path}`,

      {

        headers: {

          Accept:

            "application/json",

 

          "x-api-key":

            ADMIN_API_KEY,

        },

      },

    );

 

  const raw =

    await response.text();

 

  let payload = null;

 

  if (raw) {

    try {

      payload =

        JSON.parse(raw);

    } catch {

      payload = raw;

    }

  }

 

  if (!response.ok) {

    throw new Error(

      payload?.message ||

        payload?.error ||

        `Erreur API ${response.status}`,

    );

  }

 

  return payload;

}

 

async function loadTechnicians() {

  return planningApiFetch(

    "/sav/technicians",

  );

}

 

function normalizePlanningEntry(entry) {

  return {

    ...entry,

    scheduledStart:

      entry.scheduledStart ||

      entry.startsAt ||

      null,

    scheduledEnd:

      entry.scheduledEnd ||

      entry.endsAt ||

      null,

    ticketReference:

      entry.ticketReference ||

      null,

    ticketTitle:

      entry.ticketTitle ||

      entry.title ||

      null,

    interventionType:

      entry.interventionType ||

      "REPARATION",

    status:

      entry.status ||

      "PLANIFIEE",

    ticketPriority:

      entry.ticketPriority ||

      "NORMALE",

  };

}

 

function InterventionCard({

  intervention,

  onClick,

}) {

  return (

    <button

      type="button"

      onClick={() =>

        onClick(

          intervention,

        )

      }

      className="w-full rounded-2xl border border-[#e4d4c2] bg-white p-3 text-left shadow-sm transition hover:border-[#5b351f] hover:bg-[#fffaf3]"

    >

      <div className="flex items-start justify-between gap-2">

        <div className="min-w-0">

          <div className="text-sm font-black text-[#2d1b12]">

            {formatHour(

              intervention.scheduledStart,

            )}

 

            {intervention.scheduledEnd

              ? ` - ${formatHour(

                  intervention.scheduledEnd,

                )}`

              : ""}

          </div>

 

          <div className="mt-1 truncate text-sm font-bold text-[#5b351f]">

            {intervention.clientName ||

              "Client non renseigné"}

          </div>

        </div>

 

        <Badge

          variant="outline"

          className={priorityClasses(

            intervention.ticketPriority,

          )}

        >

          {priorityLabel(

            intervention.ticketPriority,

          )}

        </Badge>

      </div>

 

      <div className="mt-3 space-y-1 text-xs text-[#7a5f4b]">

        <div className="font-semibold text-[#2d1b12]">

          {typeLabel(

            intervention.interventionType,

          )}

        </div>

 

        <div>

          {intervention.ticketReference ||

            "Ticket SAV"}

        </div>

 

        <div>

          {intervention.machineCode ||

            "Machine non renseignée"}

        </div>

 

        <div className="flex items-center gap-1">

          <UserRound className="h-3.5 w-3.5" />

 

          {intervention.technician ||

            "Technicien non affecté"}

        </div>

      </div>

    </button>

  );

}

 

function InterventionDetail({

  intervention,

  onClose,

}) {

  if (!intervention) {

    return null;

  }

 

  return (

    <div

      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"

      onMouseDown={onClose}

    >

      <Card

        className="w-full max-w-2xl rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-2xl"

        onMouseDown={(

          event,

        ) =>

          event.stopPropagation()

        }

      >

        <CardHeader>

          <div className="flex items-start justify-between gap-4">

            <div>

              <CardTitle className="text-2xl text-[#2d1b12]">

                {intervention.ticketReference ||

                  "Intervention SAV"}

              </CardTitle>

 

              <p className="mt-1 text-sm text-[#7a5f4b]">

                {intervention.ticketTitle ||

                  typeLabel(

                    intervention.interventionType,

                  )}

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

          <div className="grid gap-4 md:grid-cols-2">

            <DetailItem

              label="Client"

              value={

                intervention.clientName ||

                "Non renseigné"

              }

              icon={UserRound}

            />

 

            <DetailItem

              label="Machine"

              value={

                intervention.machineCode ||

                "Non renseignée"

              }

              icon={Wrench}

            />

 

            <DetailItem

              label="Technicien"

              value={

                intervention.technician ||

                "Non affecté"

              }

              icon={UserRound}

            />

 

            <DetailItem

              label="Statut"

              value={statusLabel(

                intervention.status,

              )}

              icon={RefreshCw}

            />

 

            <DetailItem

              label="Début"

              value={

                intervention.scheduledStart

                  ? new Date(

                      intervention.scheduledStart,

                    ).toLocaleString(

                      "fr-FR",

                    )

                  : "Non planifié"

              }

              icon={CalendarDays}

            />

 

            <DetailItem

              label="Fin"

              value={

                intervention.scheduledEnd

                  ? new Date(

                      intervention.scheduledEnd,

                    ).toLocaleString(

                      "fr-FR",

                    )

                  : "Non renseignée"

              }

              icon={Clock3}

            />

 

            <DetailItem

              label="Lieu"

              value={

                intervention.locationLabel ||

                intervention.locationType ||

                "Non renseigné"

              }

              icon={MapPin}

            />

 

            <DetailItem

              label="Google Agenda"

              value={

                intervention.googleSyncStatus ||

                "NON_SYNCHRONISE"

              }

              icon={CalendarDays}

            />

          </div>

 

          {intervention.description ? (

            <div className="rounded-3xl border border-[#e4d4c2] bg-white p-5">

              <div className="text-xs font-bold uppercase tracking-wide text-[#7a5f4b]">

                Intervention

              </div>

 

              <div className="mt-2 text-sm leading-relaxed text-[#2d1b12]">

                {intervention.description}

              </div>

            </div>

          ) : null}

 

          {intervention.internalComment ? (

            <div className="rounded-3xl border border-[#e4d4c2] bg-white p-5">

              <div className="text-xs font-bold uppercase tracking-wide text-[#7a5f4b]">

                Commentaire interne

              </div>

 

              <div className="mt-2 text-sm leading-relaxed text-[#2d1b12]">

                {intervention.internalComment}

              </div>

            </div>

          ) : null}

        </CardContent>

      </Card>

    </div>

  );

}

 

function DetailItem({

  label,

  value,

  icon: Icon,

}) {

  return (

    <div className="rounded-2xl border border-[#e4d4c2] bg-white p-4">

      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#7a5f4b]">

        <Icon className="h-4 w-4" />

        {label}

      </div>

 

      <div className="mt-2 text-sm font-bold text-[#2d1b12]">

        {value}

      </div>

    </div>

  );

}

 

export default function PlanningBoard() {

  const [

    weekStart,

    setWeekStart,

  ] = useState(() =>

    startOfWeek(

      new Date(),

    ),

  );

 

  const [

    interventions,

    setInterventions,

  ] = useState([]);

 

  const [

    loading,

    setLoading,

  ] = useState(true);

 

  const [

    error,

    setError,

  ] = useState("");

 

  const [

    selectedIntervention,

    setSelectedIntervention,

  ] = useState(null);

 

  const [

    technicians,

    setTechnicians,

  ] = useState([]);

 

  const [

    technicianFilter,

    setTechnicianFilter,

  ] = useState("ALL");

 

  const weekDays =

    useMemo(

      () =>

        Array.from(

          {

            length: 5,

          },

          (_, index) =>

            addDays(

              weekStart,

              index,

            ),

        ),

      [weekStart],

    );

 

  const weekEnd =

    useMemo(

      () =>

        addDays(

          weekStart,

          7,

        ),

      [weekStart],

    );

 

  async function loadPlanning() {

    try {

      setLoading(true);

      setError("");

 

      const from =

        encodeURIComponent(

          toApiDateTime(

            weekStart,

          ),

        );

 

      const to =

        encodeURIComponent(

          toApiDateTime(

            weekEnd,

          ),

        );

 

      const params = new URLSearchParams();

      params.set("from", toApiDateTime(weekStart));

      params.set("to", toApiDateTime(weekEnd));

 

      if (technicianFilter !== "ALL") {

        params.set("technician", technicianFilter);

      }

 

      const result =

        await planningApiFetch(

          `/sav/planning?${params.toString()}`,

        );

 

      setInterventions(

        Array.isArray(result)

          ? result.map(normalizePlanningEntry)

          : [],

      );

    } catch (loadError) {

      console.error(

        "PLANNING LOAD ERROR",

        loadError,

      );

 

      setError(

        loadError?.message ||

          "Impossible de charger le planning SAV.",

      );

 

      setInterventions([]);

    } finally {

      setLoading(false);

    }

  }

 

  useEffect(() => {

    loadPlanning();

  }, [weekStart, technicianFilter]);

 

  useEffect(() => {

    loadTechnicians()

      .then((rows) => {

        setTechnicians(

          Array.isArray(rows) ? rows : [],

        );

      })

      .catch((error) => {

        console.error(

          "PLANNING TECHNICIANS ERROR",

          error,

        );

        setTechnicians([]);

      });

  }, []);

 

  const today =

    new Date();

 

  const todayCount =

    interventions.filter(

      (intervention) =>

        intervention.scheduledStart &&

        sameDay(

          new Date(

            intervention.scheduledStart,

          ),

          today,

        ),

    ).length;

 

  const plannedCount =

    interventions.filter(

      (intervention) =>

        intervention.status !==

        "ANNULEE",

    ).length;

 

  const unassignedCount =

    interventions.filter(

      (intervention) =>

        !intervention.technician &&

        intervention.status !==

          "ANNULEE",

    ).length;

 

  const unscheduled =

    interventions.filter(

      (intervention) =>

        !intervention.scheduledStart,

    );

 

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

                  <CardTitle className="text-2xl text-[#2d1b12]">

                    Planning SAV

                  </CardTitle>

 

                  <p className="mt-1 text-sm text-[#7a5f4b]">

                    Interventions, réparations et affectations techniciens.

                  </p>

                </div>

              </div>

 

              <div className="flex flex-wrap items-center gap-2">

                <Button

                  type="button"

                  variant="outline"

                  className="rounded-2xl border-[#d8c4ad] bg-white text-[#5b351f]"

                  onClick={() =>

                    setWeekStart(

                      addDays(

                        weekStart,

                        -7,

                      ),

                    )

                  }

                >

                  <ChevronLeft className="mr-1 h-4 w-4" />

                  Précédente

                </Button>

 

                <Button

                  type="button"

                  variant="outline"

                  className="rounded-2xl border-[#d8c4ad] bg-white text-[#5b351f]"

                  onClick={() =>

                    setWeekStart(

                      startOfWeek(

                        new Date(),

                      ),

                    )

                  }

                >

                  Aujourd’hui

                </Button>

 

                <Button

                  type="button"

                  variant="outline"

                  className="rounded-2xl border-[#d8c4ad] bg-white text-[#5b351f]"

                  onClick={() =>

                    setWeekStart(

                      addDays(

                        weekStart,

                        7,

                      ),

                    )

                  }

                >

                  Suivante

                  <ChevronRight className="ml-1 h-4 w-4" />

                </Button>

 

                <Button

                  type="button"

                  className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"

                  onClick={

                    loadPlanning

                  }

                  disabled={loading}

                >

                  <RefreshCw

                    className={`mr-2 h-4 w-4 ${

                      loading

                        ? "animate-spin"

                        : ""

                    }`}

                  />

                  Actualiser

                </Button>

              </div>

            </div>

          </CardHeader>

 

          <CardContent>

            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e4d4c2] bg-white p-4 md:flex-row md:items-center md:justify-between">

              <div>

                <div className="text-sm font-black text-[#2d1b12]">

                  Vue du planning

                </div>

                <div className="mt-1 text-xs text-[#7a5f4b]">

                  Vue Manager pour tous les techniciens ou planning individuel.

                </div>

              </div>

 

              <select

                value={technicianFilter}

                onChange={(event) =>

                  setTechnicianFilter(event.target.value)

                }

                className="h-11 min-w-[280px] rounded-2xl border border-[#d8c4ad] bg-[#fffdf8] px-4 text-sm font-semibold text-[#5b351f]"

              >

                <option value="ALL">

                  Tous les techniciens — Vue Manager

                </option>

                {technicians.map((technician) => (

                  <option

                    key={technician.id}

                    value={technician.id}

                  >

                    {technician.displayName}

                  </option>

                ))}

              </select>

            </div>

 

            <div className="mb-5 text-lg font-black text-[#2d1b12]">

              Semaine du{" "}

              {formatLongDate(

                weekStart,

              )}{" "}

              au{" "}

              {formatLongDate(

                addDays(

                  weekStart,

                  4,

                ),

              )}

            </div>

 

            <div className="grid gap-4 md:grid-cols-3">

              <StatBox

                title="Aujourd’hui"

                value={todayCount}

                subtitle="Interventions prévues"

              />

 

              <StatBox

                title="Cette semaine"

                value={plannedCount}

                subtitle="Interventions enregistrées"

              />

 

              <StatBox

                title="À affecter"

                value={unassignedCount}

                subtitle="Sans technicien"

              />

            </div>

          </CardContent>

        </Card>

 

        {error ? (

          <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">

            <CardContent className="p-4 text-sm font-medium text-red-700">

              {error}

            </CardContent>

          </Card>

        ) : null}

 

        <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">

          <CardContent className="p-4 md:p-5">

            {loading ? (

              <div className="flex min-h-[400px] items-center justify-center text-sm text-[#7a5f4b]">

                Chargement du planning...

              </div>

            ) : (

              <div className="overflow-x-auto">

                <div className="grid min-w-[1100px] grid-cols-5 gap-3">

                  {weekDays.map(

                    (

                      day,

                      dayIndex,

                    ) => {

                      const items =

                        interventions.filter(

                          (

                            intervention,

                          ) =>

                            intervention.scheduledStart &&

                            sameDay(

                              new Date(

                                intervention.scheduledStart,

                              ),

                              day,

                            ),

                        );

 

                      const isToday =

                        sameDay(

                          day,

                          today,

                        );

 

                      return (

                        <div

                          key={

                            day.toISOString()

                          }

                          className={`min-h-[520px] rounded-3xl border p-3 ${

                            isToday

                              ? "border-[#5b351f] bg-[#f8ecdf]"

                              : "border-[#e4d4c2] bg-[#fffdf8]"

                          }`}

                        >

                          <div className="mb-4 border-b border-[#eadcc9] pb-3">

                            <div className="text-sm font-black uppercase tracking-wide text-[#5b351f]">

                              {

                                DAY_NAMES[

                                  dayIndex

                                ]

                              }

                            </div>

 

                            <div className="mt-1 text-xl font-black text-[#2d1b12]">

                              {formatDay(

                                day,

                              )}

                            </div>

 

                            <div className="mt-1 text-xs text-[#7a5f4b]">

                              {items.length}{" "}

                              intervention

                              {items.length >

                              1

                                ? "s"

                                : ""}

                            </div>

                          </div>

 

                          <div className="space-y-3">

                            {items.length >

                            0 ? (

                              items.map(

                                (

                                  intervention,

                                ) => (

                                  <InterventionCard

                                    key={

                                      intervention.id

                                    }

                                    intervention={

                                      intervention

                                    }

                                    onClick={

                                      setSelectedIntervention

                                    }

                                  />

                                ),

                              )

                            ) : (

                              <div className="rounded-2xl border border-dashed border-[#d8c4ad] p-5 text-center text-xs text-[#9a8571]">

                                Aucun créneau

                              </div>

                            )}

                          </div>

                        </div>

                      );

                    },

                  )}

                </div>

              </div>

            )}

          </CardContent>

        </Card>

 

        {unscheduled.length >

        0 ? (

          <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">

            <CardHeader>

              <CardTitle className="text-xl text-[#2d1b12]">

                À planifier

              </CardTitle>

 

              <p className="text-sm text-[#7a5f4b]">

                Interventions créées sans date ni heure.

              </p>

            </CardHeader>

 

            <CardContent>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

                {unscheduled.map(

                  (

                    intervention,

                  ) => (

                    <InterventionCard

                      key={

                        intervention.id

                      }

                      intervention={

                        intervention

                      }

                      onClick={

                        setSelectedIntervention

                      }

                    />

                  ),

                )}

              </div>

            </CardContent>

          </Card>

        ) : null}

      </div>

 

      <InterventionDetail

        intervention={

          selectedIntervention

        }

        onClose={() =>

          setSelectedIntervention(

            null,

          )

        }

      />

    </>

  );

}

 

function StatBox({

  title,

  value,

  subtitle,

}) {

  return (

    <div className="rounded-3xl border border-[#e4d4c2] bg-white p-5 shadow-sm">

      <div className="text-sm font-bold text-[#7a5f4b]">

        {title}

      </div>

 

      <div className="mt-2 text-3xl font-black text-[#2d1b12]">

        {value}

      </div>

 

      <div className="mt-1 text-xs text-[#9a8571]">

        {subtitle}

      </div>

    </div>

  );

}