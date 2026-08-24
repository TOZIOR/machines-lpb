import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  TicketCheck,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || "/api",
).replace(/\/+$/, "");

const ADMIN_API_KEY =
  import.meta.env.VITE_ADMIN_API_KEY || "";

const COLUMNS = [
  {
    key: "NOUVEAU",
    label: "Nouveau",
    icon: CircleDot,
  },
  {
    key: "DIAGNOSTIC",
    label: "Diagnostic",
    icon: ClipboardList,
  },
  {
    key: "PIECES",
    label: "Attente pièces",
    icon: Clock3,
  },
  {
    key: "PLANIFIE",
    label: "Planifié",
    icon: CalendarClock,
  },
  {
    key: "EN_COURS",
    label: "En cours",
    icon: Wrench,
  },
  {
    key: "CLOTURE",
    label: "Clôturé",
    icon: CheckCircle2,
  },
];

const PRIORITIES = [
  "BASSE",
  "NORMALE",
  "HAUTE",
  "CRITIQUE",
];

const QUOTE_STATUSES = [
  {
    key: "A_FAIRE",
    label: "À faire",
  },
  {
    key: "ENVOYE",
    label: "Envoyé — en attente de réponse",
  },
  {
    key: "VALIDE",
    label: "Validé par le client",
  },
  {
    key: "REFUSE",
    label: "Refusé par le client",
  },
];

function normalizeTicket(ticket) {
  return {
    ...ticket,
    clientId:
      ticket.clientId ||
      ticket.crmClientId ||
      null,
    crmClientId:
      ticket.crmClientId ||
      ticket.clientId ||
      null,
    technician:
      ticket.technician || "",
    technicianId:
      ticket.technicianId || null,
    history: Array.isArray(ticket.history)
      ? ticket.history
      : [],
    quoteStatus:
      ticket.quoteStatus || "A_FAIRE",
    plannedRepairDate:
      ticket.plannedRepairDate || null,
    plannedRepairStart:
      ticket.plannedRepairStart || null,
    plannedRepairEnd:
      ticket.plannedRepairEnd || null,
    openedAt:
      ticket.openedAt || ticket.createdAt || null,
  };
}

function priorityClasses(priority) {
  if (priority === "CRITIQUE") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority === "HAUTE") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (priority === "BASSE") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function nextStatus(status) {
  const index = COLUMNS.findIndex(
    (column) => column.key === status,
  );

  return (
    COLUMNS[
      Math.min(
        index + 1,
        COLUMNS.length - 1,
      )
    ]?.key || status
  );
}

function previousStatus(status) {
  const index = COLUMNS.findIndex(
    (column) => column.key === status,
  );

  if (index <= 0) {
    return status;
  }

  return COLUMNS[index - 1]?.key || status;
}

function getStatusLabel(status) {
  return (
    COLUMNS.find(
      (column) => column.key === status,
    )?.label || status
  );
}

function getQuoteStatusLabel(status) {
  return (
    QUOTE_STATUSES.find(
      (item) => item.key === status,
    )?.label || "À faire"
  );
}

function getClientKey(client) {
  return String(
    client?.crmClientId ||
      client?.id ||
      client?.pennylaneCustomerId ||
      "",
  );
}

function getClientName(client) {
  return String(
    client?.nom ||
      client?.name ||
      "",
  );
}

function machineBelongsToClient(
  machine,
  client,
) {
  if (!machine || !client) {
    return false;
  }

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

  return machineClientIds.some(
    (value) =>
      clientIds.includes(value),
  );
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    const raw = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T12:00:00`)
      : new Date(raw);

    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    ).format(date);
  } catch {
    return String(value);
  }
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date);
  } catch {
    return "";
  }
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(new Date(value));
  } catch {
    return value;
  }
}

async function savApiRequest(
  path,
  {
    method = "GET",
    body,
  } = {},
) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers: {
        Accept: "application/json",
        ...(ADMIN_API_KEY
          ? {
              "x-api-key":
                ADMIN_API_KEY,
            }
          : {}),
        ...(body !== undefined
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),
      },
      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
          }
        : {}),
    },
  );

  const raw =
    await response.text();

  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Erreur API ${response.status}`;

    throw new Error(message);
  }

  return payload;
}

async function loadSavTickets() {
  const payload =
    await savApiRequest(
      "/sav/tickets",
    );

  return Array.isArray(payload)
    ? payload.map(normalizeTicket)
    : [];
}

async function loadSavTicket(ticketId) {
  const payload =
    await savApiRequest(
      `/sav/tickets/${encodeURIComponent(
        ticketId,
      )}`,
    );

  return normalizeTicket(payload);
}

async function createSavTicket(payload) {
  return savApiRequest(
    "/sav/tickets",
    {
      method: "POST",
      body: payload,
    },
  );
}

async function patchSavTicket(
  ticketId,
  payload,
) {
  return savApiRequest(
    `/sav/tickets/${encodeURIComponent(
      ticketId,
    )}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

async function deleteSavTicket(ticketId) {
  return savApiRequest(
    `/sav/tickets/${encodeURIComponent(
      ticketId,
    )}`,
    {
      method: "DELETE",
    },
  );
}

async function loadSavInterventions(ticketId) {
  const params = new URLSearchParams();
  params.set("ticketId", ticketId);

  const payload = await savApiRequest(
    `/sav/interventions?${params.toString()}`,
  );

  return Array.isArray(payload)
    ? payload
    : [];
}

async function createSavIntervention(payload) {
  return savApiRequest(
    "/sav/interventions",
    {
      method: "POST",
      body: payload,
    },
  );
}

async function patchSavIntervention(
  interventionId,
  payload,
) {
  return savApiRequest(
    `/sav/interventions/${encodeURIComponent(
      interventionId,
    )}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

async function deleteSavIntervention(interventionId) {
  return savApiRequest(
    `/sav/interventions/${encodeURIComponent(
      interventionId,
    )}`,
    {
      method: "DELETE",
    },
  );
}

function buildPlannedInterventionTimes({
  date,
  time,
  durationMinutes,
}) {
  const start = new Date(
    `${date}T${time}:00`,
  );

  if (Number.isNaN(start.getTime())) {
    throw new Error(
      "La date ou l'heure de l'intervention est invalide.",
    );
  }

  const duration = Number(durationMinutes);

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error(
      "La durée de l'intervention est invalide.",
    );
  }

  const end = new Date(
    start.getTime() +
      duration * 60 * 1000,
  );

  return {
    scheduledStart: start.toISOString(),
    scheduledEnd: end.toISOString(),
  };
}

async function findActiveTicketIntervention(ticketId) {
  const interventions =
    await loadSavInterventions(ticketId);

  return (
    interventions.find(
      (item) =>
        ![
          "TERMINEE",
          "ANNULEE",
        ].includes(item.status),
    ) || null
  );
}

async function loadSavTechnicians() {
  const payload = await savApiRequest(
    "/sav/technicians",
  );

  return Array.isArray(payload)
    ? payload
    : [];
}

async function searchCrmClients(search) {
  const params =
    new URLSearchParams();

  params.set("search", search);
  params.set("limit", "20");

  const response = await fetch(
    `${API_BASE_URL}/clients?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(ADMIN_API_KEY
          ? {
              "x-api-key":
                ADMIN_API_KEY,
            }
          : {}),
      },
    },
  );

  const raw =
    await response.text();

  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Erreur API ${response.status}`;

    throw new Error(message);
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (
    Array.isArray(payload?.clients)
  ) {
    return payload.clients;
  }

  if (
    Array.isArray(payload?.items)
  ) {
    return payload.items;
  }

  return [];
}

export default function TicketsBoard({
  clients = [],
  machines = [],
  initialContext = null,
  onInitialContextConsumed,
}) {
  const [tickets, setTickets] =
    useState([]);

  const [
    ticketsLoading,
    setTicketsLoading,
  ] = useState(true);

  const [
    ticketsError,
    setTicketsError,
  ] = useState("");

  const [query, setQuery] =
    useState("");

  const [showForm, setShowForm] =
    useState(
      Boolean(initialContext),
    );

  const [
    selectedTicket,
    setSelectedTicket,
  ] = useState(null);

  const [
    technicians,
    setTechnicians,
  ] = useState([]);

  const [
    techniciansError,
    setTechniciansError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    async function refreshTickets() {
      try {
        setTicketsLoading(true);
        setTicketsError("");

        const loaded =
          await loadSavTickets();

        if (active) {
          setTickets(loaded);
        }
      } catch (error) {
        console.error(
          "SAV TICKETS LOAD ERROR",
          error,
        );

        if (active) {
          setTicketsError(
            error?.message ||
              "Impossible de charger les tickets SAV.",
          );
        }
      } finally {
        if (active) {
          setTicketsLoading(false);
        }
      }
    }

    refreshTickets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    loadSavTechnicians()
      .then((rows) => {
        if (active) {
          setTechnicians(rows);
          setTechniciansError("");
        }
      })
      .catch((error) => {
        console.error(
          "SAV TECHNICIANS LOAD ERROR",
          error,
        );

        if (active) {
          setTechnicians([]);
          setTechniciansError(
            error?.message ||
              "Impossible de charger les techniciens.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTicket?.id) {
      return;
    }

    const refreshedTicket =
      tickets.find(
        (ticket) =>
          ticket.id ===
          selectedTicket.id,
      );

    if (!refreshedTicket) {
      setSelectedTicket(null);
      return;
    }

    setSelectedTicket(
      (current) =>
        current
          ? {
              ...current,
              ...refreshedTicket,
              history:
                current.history || [],
            }
          : current,
    );
  }, [
    tickets,
    selectedTicket?.id,
  ]);

  const [
    transitionTicket,
    setTransitionTicket,
  ] = useState(null);

  const [
    transitionDirection,
    setTransitionDirection,
  ] = useState("NEXT");

  const [
    transitionForm,
    setTransitionForm,
  ] = useState({
    comment: "",
    plannedRepairDate: "",
    plannedRepairTime: "09:00",
    durationMinutes: "60",
    technicianId: "",
    technician: "",
    locationType: "ATELIER",
    locationLabel: "",
  });

  const [
    clientSearch,
    setClientSearch,
  ] = useState(
    initialContext?.clientName || "",
  );

  const [
    clientResults,
    setClientResults,
  ] = useState([]);

  const [
    clientSearchOpen,
    setClientSearchOpen,
  ] = useState(false);

  const [
    clientSearchLoading,
    setClientSearchLoading,
  ] = useState(false);

  const [
    clientSearchError,
    setClientSearchError,
  ] = useState("");

  const clientSearchRequest =
    useRef(0);

  const [form, setForm] = useState(
    () => ({
      title: "",
      machineCode:
        initialContext?.machineCode ||
        "",
      clientName:
        initialContext?.clientName ||
        "",
      priority: "NORMALE",
      description: "",
      technicianId: "",
      technician: "",
      machineId:
        initialContext?.machineId ||
        "",
      clientId:
        initialContext?.clientId ||
        "",
      pennylaneCustomerId:
        initialContext?.pennylaneCustomerId ||
        "",
    }),
  );

  useEffect(() => {
    const normalizedSearch =
      clientSearch.trim();

    if (!showForm) {
      return undefined;
    }

    if (
      form.clientId &&
      normalizedSearch ===
        form.clientName
    ) {
      setClientResults([]);
      setClientSearchOpen(false);

      return undefined;
    }

    if (
      normalizedSearch.length < 2
    ) {
      setClientResults([]);
      setClientSearchError("");
      setClientSearchOpen(false);
      setClientSearchLoading(false);

      return undefined;
    }

    const requestId =
      clientSearchRequest.current + 1;

    clientSearchRequest.current =
      requestId;

    const timer =
      window.setTimeout(
        async () => {
          try {
            setClientSearchLoading(
              true,
            );

            setClientSearchError("");

            const results =
              await searchCrmClients(
                normalizedSearch,
              );

            if (
              clientSearchRequest.current !==
              requestId
            ) {
              return;
            }

            setClientResults(
              results.slice(0, 20),
            );

            setClientSearchOpen(
              true,
            );
          } catch (error) {
            if (
              clientSearchRequest.current !==
              requestId
            ) {
              return;
            }

            console.error(
              "CRM CLIENT SEARCH ERROR",
              error,
            );

            setClientResults([]);
            setClientSearchOpen(
              true,
            );

            setClientSearchError(
              error?.message ||
                "Impossible de rechercher les clients.",
            );
          } finally {
            if (
              clientSearchRequest.current ===
              requestId
            ) {
              setClientSearchLoading(
                false,
              );
            }
          }
        },
        300,
      );

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    clientSearch,
    showForm,
    form.clientId,
    form.clientName,
  ]);

  function replaceTicketInList(
    updatedTicket,
  ) {
    const normalized =
      normalizeTicket(
        updatedTicket,
      );

    setTickets((current) => {
      const exists =
        current.some(
          (ticket) =>
            ticket.id ===
            normalized.id,
        );

      if (!exists) {
        return [
          normalized,
          ...current,
        ];
      }

      return current.map(
        (ticket) =>
          ticket.id ===
          normalized.id
            ? normalized
            : ticket,
      );
    });

    return normalized;
  }

  async function openTicket(ticket) {
    setSelectedTicket(ticket);

    try {
      const detailed =
        await loadSavTicket(
          ticket.id,
        );

      replaceTicketInList(
        detailed,
      );

      setSelectedTicket(
        detailed,
      );
    } catch (error) {
      console.error(
        "SAV TICKET DETAIL ERROR",
        error,
      );

      window.alert(
        error?.message ||
          "Impossible de charger le détail du ticket SAV.",
      );
    }
  }

  function closeForm() {
    setShowForm(false);
    setClientResults([]);
    setClientSearchOpen(false);
    setClientSearchError("");

    onInitialContextConsumed?.();
  }

  function selectMachine(machineId) {
    const machine = machines.find(
      (item) =>
        String(item.id) ===
        String(machineId),
    );

    if (!machine) {
      setForm((current) => ({
        ...current,
        machineId: "",
        machineCode: "",
      }));

      return;
    }

    const machineCode =
      machine.code ||
      machine.numero ||
      machine.numeroInterne ||
      machine.id;

    const client = clients.find(
      (item) =>
        machineBelongsToClient(
          machine,
          item,
        ),
    );

    setForm((current) => ({
      ...current,

      machineId:
        machine.id,

      machineCode:
        String(machineCode || ""),

      clientId: client
        ? getClientKey(client)
        : current.clientId || "",

      clientName: client
        ? getClientName(client)
        : current.clientName || "",

      pennylaneCustomerId:
        client?.pennylaneCustomerId ||
        machine.pennylaneCustomerId ||
        current.pennylaneCustomerId ||
        "",
    }));

    if (client) {
      setClientSearch(
        getClientName(client),
      );

      setClientSearchOpen(false);
      setClientResults([]);
    }
  }

  function chooseClient(client) {
    if (!client) {
      return;
    }

    const clientId =
      getClientKey(client);

    const clientName =
      getClientName(client);

    /*
     * IMPORTANT :
     * le choix d'un client ne doit jamais
     * supprimer la machine déjà sélectionnée
     * dans le ticket SAV.
     */
    setForm((current) => ({
      ...current,

      clientId,
      clientName,

      pennylaneCustomerId:
        client.pennylaneCustomerId ||
        "",
    }));

    setClientSearch(clientName);
    setClientResults([]);
    setClientSearchOpen(false);
    setClientSearchError("");
  }

  function clearSelectedClient() {
    /*
     * On efface uniquement le client.
     * La machine reste sélectionnée.
     */
    setForm((current) => ({
      ...current,

      clientId: "",
      clientName: "",
      pennylaneCustomerId: "",
    }));

    setClientSearch("");
    setClientResults([]);
    setClientSearchOpen(false);
    setClientSearchError("");
  }

  function handleClientSearchChange(
    event,
  ) {
    const value =
      event.target.value;

    setClientSearch(value);

    if (
      form.clientId &&
      value !== form.clientName
    ) {
      /*
       * Là encore, on ne touche
       * jamais à la machine.
       */
      setForm((current) => ({
        ...current,

        clientId: "",
        clientName: "",
        pennylaneCustomerId: "",
      }));
    }
  }

  const filteredTickets =
    useMemo(() => {
      const normalized =
        query.trim().toLowerCase();

      if (!normalized) {
        return tickets;
      }

      return tickets.filter(
        (ticket) =>
          [
            ticket.reference,
            ticket.title,
            ticket.machineCode,
            ticket.clientName,
            ticket.technician,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalized),
      );
    }, [tickets, query]);

  const metrics = useMemo(
    () => ({
      open: tickets.filter(
        (ticket) =>
          ticket.status !==
          "CLOTURE",
      ).length,

      critical: tickets.filter(
        (ticket) =>
          ticket.priority ===
            "CRITIQUE" &&
          ticket.status !==
            "CLOTURE",
      ).length,

      active: tickets.filter(
        (ticket) =>
          ticket.status ===
          "EN_COURS",
      ).length,

      planned: tickets.filter(
        (ticket) =>
          ticket.status ===
          "PLANIFIE",
      ).length,
    }),
    [tickets],
  );

  async function createTicket(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      return;
    }

    try {
      const created =
        await createSavTicket({
          title:
            form.title.trim(),
          machineId:
            form.machineId ||
            null,
          machineCode:
            form.machineCode.trim() ||
            null,
          crmClientId:
            form.clientId ||
            null,
          pennylaneCustomerId:
            form.pennylaneCustomerId ||
            null,
          clientName:
            form.clientName.trim() ||
            null,
          priority:
            form.priority,
          description:
            form.description.trim() ||
            null,
          technicianId:
            form.technicianId ||
            null,
          technician:
            form.technician ||
            null,
          status:
            "NOUVEAU",
          quoteStatus:
            "A_FAIRE",
          comment:
            form.description.trim() ||
            "Ticket SAV créé.",
        });

      const detailed =
        await loadSavTicket(
          created.id,
        );

      replaceTicketInList(
        detailed,
      );

      setForm({
        title: "",
        machineCode: "",
        clientName: "",
        priority: "NORMALE",
        description: "",
        technicianId: "",
        technician: "",
        machineId: "",
        clientId: "",
        pennylaneCustomerId: "",
      });

      setClientSearch("");
      setClientResults([]);
      setClientSearchOpen(false);
      setShowForm(false);

      onInitialContextConsumed?.();

      setSelectedTicket(
        detailed,
      );
    } catch (error) {
      console.error(
        "CREATE SAV TICKET ERROR",
        error,
      );

      window.alert(
        error?.message ||
          "Impossible de créer le ticket SAV.",
      );
    }
  }

  function openTransition(
    ticket,
    direction = "NEXT",
  ) {
    const targetStatus =
      direction === "PREVIOUS"
        ? previousStatus(ticket.status)
        : nextStatus(ticket.status);

    setTransitionDirection(direction);
    setTransitionTicket(ticket);

    setTransitionForm({
      comment: "",
      plannedRepairDate:
        direction === "NEXT" &&
        targetStatus === "PLANIFIE"
          ? String(ticket.plannedRepairDate || "").slice(0, 10)
          : "",
      plannedRepairTime: "09:00",
      durationMinutes: "60",
      technicianId:
        ticket.technicianId || "",
      technician:
        ticket.technician || "",
      locationType: "ATELIER",
      locationLabel: "",
    });
  }

  function closeTransition() {
    setTransitionTicket(null);
    setTransitionDirection("NEXT");

    setTransitionForm({
      comment: "",
      plannedRepairDate: "",
      plannedRepairTime: "09:00",
      durationMinutes: "60",
      technicianId: "",
      technician: "",
      locationType: "ATELIER",
      locationLabel: "",
    });
  }

  async function confirmTransition(
    event,
  ) {
    event.preventDefault();

    if (!transitionTicket) {
      return;
    }

    const comment =
      transitionForm.comment.trim();

    if (!comment) {
      return;
    }

    const fromStatus =
      transitionTicket.status;

    const toStatus =
      transitionDirection ===
      "PREVIOUS"
        ? previousStatus(
            fromStatus,
          )
        : nextStatus(
            fromStatus,
          );

    const isPlanning =
      transitionDirection ===
        "NEXT" &&
      toStatus === "PLANIFIE";

    if (isPlanning) {
      if (
        !transitionForm.plannedRepairDate ||
        !transitionForm.plannedRepairTime ||
        !transitionForm.technicianId
      ) {
        return;
      }
    }

    const payload = {
      status: toStatus,
      comment,
      label:
        `${getStatusLabel(
          fromStatus,
        )} → ${getStatusLabel(
          toStatus,
        )}`,
      eventType:
        transitionDirection ===
        "PREVIOUS"
          ? "STATUS_CHANGE_BACKWARD"
          : "STATUS_CHANGE",
      direction:
        transitionDirection,
    };

    if (isPlanning) {
      payload.plannedRepairDate =
        transitionForm.plannedRepairDate;

      payload.technicianId =
        transitionForm.technicianId;

      payload.technician =
        transitionForm.technician || null;
    }

    if (
      transitionDirection ===
        "PREVIOUS" &&
      fromStatus === "PLANIFIE"
    ) {
      payload.plannedRepairDate =
        null;
    }

    try {
      await patchSavTicket(
        transitionTicket.id,
        payload,
      );

      if (isPlanning) {
        const {
          scheduledStart,
          scheduledEnd,
        } = buildPlannedInterventionTimes({
          date:
            transitionForm.plannedRepairDate,
          time:
            transitionForm.plannedRepairTime,
          durationMinutes:
            transitionForm.durationMinutes,
        });

        const existing =
          await findActiveTicketIntervention(
            transitionTicket.id,
          );

        const interventionPayload = {
          ticketId:
            transitionTicket.id,
          machineId:
            transitionTicket.machineId ||
            null,
          machineCode:
            transitionTicket.machineCode ||
            null,
          crmClientId:
            transitionTicket.crmClientId ||
            transitionTicket.clientId ||
            null,
          technicianId:
            transitionForm.technicianId,
          technician:
            transitionForm.technician || null,
          interventionType:
            "REPARATION",
          locationType:
            transitionForm.locationType,
          locationLabel:
            transitionForm.locationLabel.trim() ||
            null,
          scheduledStart,
          scheduledEnd,
          status: "PLANIFIEE",
          description:
            transitionTicket.description ||
            transitionTicket.title ||
            null,
          internalComment:
            comment,
        };

        if (existing) {
          await patchSavIntervention(
            existing.id,
            interventionPayload,
          );
        } else {
          await createSavIntervention(
            interventionPayload,
          );
        }
      }

      if (
        transitionDirection ===
          "PREVIOUS" &&
        fromStatus === "PLANIFIE"
      ) {
        const existing =
          await findActiveTicketIntervention(
            transitionTicket.id,
          );

        if (existing) {
          await deleteSavIntervention(
            existing.id,
          );
        }
      }

      if (
        fromStatus === "PLANIFIE" &&
        toStatus === "EN_COURS"
      ) {
        const existing =
          await findActiveTicketIntervention(
            transitionTicket.id,
          );

        if (existing) {
          await patchSavIntervention(
            existing.id,
            {
              status: "EN_COURS",
              internalComment:
                comment,
            },
          );
        }
      }

      if (
        transitionDirection ===
          "PREVIOUS" &&
        fromStatus === "EN_COURS" &&
        toStatus === "PLANIFIE"
      ) {
        const existing =
          await findActiveTicketIntervention(
            transitionTicket.id,
          );

        if (existing) {
          await patchSavIntervention(
            existing.id,
            {
              status: "PLANIFIEE",
              internalComment:
                comment,
            },
          );
        }
      }

      if (
        fromStatus === "EN_COURS" &&
        toStatus === "CLOTURE"
      ) {
        const existing =
          await findActiveTicketIntervention(
            transitionTicket.id,
          );

        if (existing) {
          await patchSavIntervention(
            existing.id,
            {
              status: "TERMINEE",
              internalComment:
                comment,
            },
          );
        }
      }

      const detailed =
        await loadSavTicket(
          transitionTicket.id,
        );

      replaceTicketInList(
        detailed,
      );

      setSelectedTicket(
        detailed,
      );

      closeTransition();
    } catch (error) {
      console.error(
        "SAV STATUS / PLANNING UPDATE ERROR",
        error,
      );

      window.alert(
        error?.message ||
          "Impossible de mettre à jour le ticket et son planning SAV.",
      );
    }
  }

  async function updateQuoteStatus(
    ticketId,
    quoteStatus,
  ) {
    const currentTicket =
      tickets.find(
        (ticket) =>
          ticket.id === ticketId,
      ) || selectedTicket;

    const previousStatus =
      currentTicket?.quoteStatus ||
      "A_FAIRE";

    if (
      previousStatus ===
      quoteStatus
    ) {
      return;
    }

    try {
      await patchSavTicket(
        ticketId,
        {
          quoteStatus,
          quoteComment:
            `${getQuoteStatusLabel(
              previousStatus,
            )} → ${getQuoteStatusLabel(
              quoteStatus,
            )}`,
        },
      );

      const detailed =
        await loadSavTicket(
          ticketId,
        );

      replaceTicketInList(
        detailed,
      );

      setSelectedTicket(
        detailed,
      );
    } catch (error) {
      console.error(
        "SAV QUOTE UPDATE ERROR",
        error,
      );

      window.alert(
        error?.message ||
          "Impossible de modifier l'état du devis.",
      );
    }
  }

  async function deleteTicket(
    ticketId,
  ) {
    if (
      !window.confirm(
        "Supprimer définitivement ce ticket SAV ?",
      )
    ) {
      return;
    }

    try {
      await deleteSavTicket(
        ticketId,
      );

      setTickets((current) =>
        current.filter(
          (ticket) =>
            ticket.id !==
            ticketId,
        ),
      );

      setSelectedTicket(null);
    } catch (error) {
      console.error(
        "DELETE SAV TICKET ERROR",
        error,
      );

      window.alert(
        error?.message ||
          "Impossible de supprimer le ticket SAV.",
      );
    }
  }

  return (
    <div className="space-y-5 p-5 md:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a6b46]">
            Exécution technique
          </p>

          <h2 className="mt-1 text-3xl font-black text-[#2d1b12]">
            Tickets SAV
          </h2>

          <p className="mt-1 text-sm text-[#7a5f4b]">
            Qualifier, diagnostiquer,
            planifier et suivre chaque
            intervention technique.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex h-11 min-w-[280px] items-center gap-2 rounded-2xl border border-[#d8c4ad] bg-white px-4 shadow-sm">
            <Search className="h-4 w-4 text-[#9a8571]" />

            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Référence, machine, client..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <Button
            onClick={() =>
              setShowForm(true)
            }
            className="h-11 rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau ticket
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Tickets ouverts"
          value={metrics.open}
          icon={TicketCheck}
        />

        <Metric
          title="Critiques"
          value={metrics.critical}
          icon={AlertTriangle}
          danger
        />

        <Metric
          title="En cours"
          value={metrics.active}
          icon={Wrench}
        />

        <Metric
          title="Planifiés"
          value={metrics.planned}
          icon={CalendarClock}
        />
      </div>

      {ticketsLoading ? (
        <div className="rounded-2xl border border-[#d8c4ad] bg-white px-4 py-3 text-sm text-[#7a5f4b]">
          Chargement des tickets SAV...
        </div>
      ) : null}

      {ticketsError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {ticketsError}
        </div>
      ) : null}

      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1500px] grid-cols-6 gap-3">
          {COLUMNS.map(
            ({
              key,
              label,
              icon: Icon,
            }) => {
              const columnTickets =
                filteredTickets.filter(
                  (ticket) =>
                    ticket.status === key,
                );

              return (
                <section
                  key={key}
                  className="rounded-3xl border border-[#d8c4ad] bg-[#fffaf3] p-3 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 font-bold text-[#2d1b12]">
                      <Icon className="h-4 w-4 text-[#9a6b46]" />
                      {label}
                    </div>

                    <Badge
                      variant="outline"
                      className="border-[#d8c4ad]"
                    >
                      {
                        columnTickets.length
                      }
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {columnTickets.map(
                      (ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() =>
                            openTicket(
                              ticket,
                            )
                          }
                          className="w-full rounded-2xl border border-[#eadcc9] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#9a6b46] hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-[#9a8571]">
                              {
                                ticket.reference
                              }
                            </span>

                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-bold ${priorityClasses(
                                ticket.priority,
                              )}`}
                            >
                              {
                                ticket.priority
                              }
                            </span>
                          </div>

                          <h3 className="mt-2 font-extrabold text-[#2d1b12]">
                            {ticket.title}
                          </h3>

                          <div className="mt-3 space-y-1 text-xs text-[#7a5f4b]">
                            <div className="font-semibold text-[#5b351f]">
                              {ticket.machineCode ||
                                "Machine non renseignée"}
                            </div>

                            <div>
                              {ticket.clientName ||
                                "Client non renseigné"}
                            </div>

                            {ticket.technician ? (
                              <div className="flex items-center gap-1">
                                <UserRound className="h-3 w-3" />
                                {
                                  ticket.technician
                                }
                              </div>
                            ) : null}

                            {ticket.plannedRepairDate ? (
                              <div className="mt-2 flex items-center gap-1 rounded-lg bg-[#fff3e5] px-2 py-1 font-semibold text-[#5b351f]">
                                <CalendarClock className="h-3 w-3" />
                                Réparation prévue :{" "}
                                {formatDate(
                                  ticket.plannedRepairDate,
                                )}
                              </div>
                            ) : null}

                            {key ===
                            "DIAGNOSTIC" ? (
                              <div className="mt-2 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Devis :{" "}
                                {getQuoteStatusLabel(
                                  ticket.quoteStatus,
                                )}
                              </div>
                            ) : null}
                          </div>

                          {key !==
                          "CLOTURE" ? (
                            <div className="mt-4 flex items-center justify-end text-xs font-bold text-[#5b351f]">
                              Étape suivante
                              <ChevronRight className="ml-1 h-3 w-3" />
                            </div>
                          ) : null}
                        </button>
                      ),
                    )}

                    {!columnTickets.length ? (
                      <div className="rounded-2xl border border-dashed border-[#d8c4ad] px-3 py-8 text-center text-xs text-[#9a8571]">
                        Aucun ticket
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            },
          )}
        </div>
      </div>

      {showForm ? (
        <Modal
          title="Créer un ticket SAV"
          onClose={closeForm}
        >
          <form
            className="space-y-4"
            onSubmit={createTicket}
          >
            <Field label="Objet du ticket *">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title:
                      event.target.value,
                  })
                }
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Machine">
                <select
                  value={form.machineId}
                  onChange={(event) =>
                    selectMachine(
                      event.target.value,
                    )
                  }
                  className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm"
                >
                  <option value="">
                    Sélectionner une machine
                  </option>

                  {machines.map(
                    (machine) => {
                      const code =
                        machine.code ||
                        machine.numero ||
                        machine.numeroInterne ||
                        machine.id;

                      return (
                        <option
                          key={
                            machine.id
                          }
                          value={
                            machine.id
                          }
                        >
                          {code} ·{" "}
                          {
                            machine.marque
                          }{" "}
                          {
                            machine.modele
                          }
                        </option>
                      );
                    },
                  )}
                </select>
              </Field>

              <Field label="Client (CRM / Pennylane)">
                <div className="relative">
                  <div className="flex h-11 items-center rounded-2xl border border-[#d8c4ad] bg-white px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 text-[#9a8571]" />

                    <input
                      value={
                        clientSearch
                      }
                      onChange={
                        handleClientSearchChange
                      }
                      onFocus={() => {
                        if (
                          clientResults.length ||
                          clientSearchError
                        ) {
                          setClientSearchOpen(
                            true,
                          );
                        }
                      }}
                      placeholder="Tapez le nom du client..."
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />

                    {clientSearchLoading ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin text-[#9a6b46]" />
                    ) : null}

                    {form.clientId ? (
                      <button
                        type="button"
                        onClick={
                          clearSelectedClient
                        }
                        className="ml-2 rounded-lg p-1 text-[#9a8571] hover:bg-[#f0dfcd]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  {clientSearchOpen ? (
                    <div className="absolute left-0 right-0 top-[48px] z-[120] max-h-72 overflow-y-auto rounded-2xl border border-[#d8c4ad] bg-white p-2 shadow-xl">
                      {clientSearchError ? (
                        <div className="px-3 py-3 text-sm text-red-700">
                          {
                            clientSearchError
                          }
                        </div>
                      ) : null}

                      {!clientSearchError &&
                      !clientSearchLoading &&
                      clientResults.length ===
                        0 ? (
                        <div className="px-3 py-4 text-sm text-[#9a8571]">
                          Aucun client
                          trouvé.
                        </div>
                      ) : null}

                      {clientResults.map(
                        (client) => (
                          <button
                            key={getClientKey(
                              client,
                            )}
                            type="button"
                            onClick={() =>
                              chooseClient(
                                client,
                              )
                            }
                            className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-[#fff3e5]"
                          >
                            <div className="font-bold text-[#2d1b12]">
                              {getClientName(
                                client,
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#7a5f4b]">
                              {client.city ? (
                                <span>
                                  {
                                    client.city
                                  }
                                </span>
                              ) : null}

                              {client.email ? (
                                <span>
                                  {
                                    client.email
                                  }
                                </span>
                              ) : null}

                              {client.telephone ||
                              client.phone ? (
                                <span>
                                  {client.telephone ||
                                    client.phone}
                                </span>
                              ) : null}

                              {client.pennylaneCustomerId ? (
                                <span className="font-semibold text-[#9a6b46]">
                                  Pennylane
                                </span>
                              ) : null}
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}

                  {!form.clientId &&
                  clientSearch.length >
                    0 &&
                  clientSearch.length <
                    2 ? (
                    <p className="mt-1 text-xs text-[#9a8571]">
                      Tapez au moins 2
                      caractères.
                    </p>
                  ) : null}

                  {form.clientId ? (
                    <p className="mt-1 text-xs font-semibold text-green-700">
                      Client CRM
                      sélectionné
                    </p>
                  ) : null}
                </div>
              </Field>

              <Field label="Priorité">
                <select
                  value={
                    form.priority
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priority:
                        event.target.value,
                    })
                  }
                  className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm"
                >
                  {PRIORITIES.map(
                    (priority) => (
                      <option
                        key={
                          priority
                        }
                      >
                        {priority}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Technicien">
                <select
                  value={form.technicianId}
                  onChange={(event) => {
                    const technician = technicians.find(
                      (item) => item.id === event.target.value,
                    );

                    setForm({
                      ...form,
                      technicianId: event.target.value,
                      technician: technician?.displayName || "",
                    });
                  }}
                  className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm"
                >
                  <option value="">Non affecté</option>
                  {technicians.map((technician) => (
                    <option
                      key={technician.id}
                      value={technician.id}
                    >
                      {technician.displayName}
                    </option>
                  ))}
                </select>
                {techniciansError ? (
                  <p className="mt-1 text-xs text-red-700">
                    {techniciansError}
                  </p>
                ) : null}
              </Field>

              <Field label="Date d’ouverture">
                <Input
                  type="date"
                  value={localDateInputValue()}
                  readOnly
                  disabled
                />
                <p className="mt-1 text-xs text-[#7a5f4b]">
                  Renseignée automatiquement à la création du ticket.
                </p>
              </Field>
            </div>

            <Field label="Description technique">
              <Textarea
                value={
                  form.description
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    description:
                      event.target.value,
                  })
                }
                rows={5}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                className="rounded-2xl"
              >
                Annuler
              </Button>

              <Button
                type="submit"
                className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"
              >
                Créer le ticket
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {selectedTicket ? (
        <Modal
          title={
            selectedTicket.reference
          }
          onClose={() =>
            setSelectedTicket(null)
          }
        >
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-[#2d1b12]">
                  {
                    selectedTicket.title
                  }
                </h3>

                <span
                  className={`rounded-full border px-2 py-1 text-xs font-bold ${priorityClasses(
                    selectedTicket.priority,
                  )}`}
                >
                  {
                    selectedTicket.priority
                  }
                </span>
              </div>

              <p className="mt-2 text-sm text-[#7a5f4b]">
                {selectedTicket.description ||
                  "Aucune description technique."}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Info
                label="Machine"
                value={
                  selectedTicket.machineCode ||
                  "Non renseignée"
                }
              />

              <Info
                label="Client"
                value={
                  selectedTicket.clientName ||
                  "Non renseigné"
                }
              />

              <Info
                label="Technicien"
                value={
                  selectedTicket.technician ||
                  "Non affecté"
                }
              />

              <Info
                label="Statut"
                value={getStatusLabel(
                  selectedTicket.status,
                )}
              />
            </div>

            {selectedTicket.plannedRepairDate ? (
              <div className="rounded-2xl border border-[#e5c89f] bg-[#fff3e5] p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#5b351f]">
                  <CalendarClock className="h-5 w-5" />
                  Réparation prévue
                </div>

                <div className="mt-2 text-xl font-black text-[#2d1b12]">
                  {selectedTicket.plannedRepairStart
                    ? formatDateTime(selectedTicket.plannedRepairStart)
                    : formatDate(selectedTicket.plannedRepairDate)}
                  {selectedTicket.plannedRepairStart &&
                  selectedTicket.plannedRepairEnd
                    ? ` → ${formatTime(selectedTicket.plannedRepairEnd)}`
                    : ""}
                </div>

                <p className="mt-1 text-sm text-[#7a5f4b]">
                  Créneau annoncé pour la prise en charge de la réparation.
                </p>
              </div>
            ) : null}

            {selectedTicket.status ===
            "DIAGNOSTIC" ? (
              <div className="rounded-2xl border border-[#d8c4ad] bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#9a6b46]" />

                  <div>
                    <div className="font-bold text-[#2d1b12]">
                      Devis Pennylane
                    </div>

                    <div className="text-xs text-[#7a5f4b]">
                      Le devis reste
                      créé et envoyé
                      depuis Pennylane.
                    </div>
                  </div>
                </div>

                <Field label="État du devis">
                  <select
                    value={
                      selectedTicket.quoteStatus ||
                      "A_FAIRE"
                    }
                    onChange={(event) =>
                      updateQuoteStatus(
                        selectedTicket.id,
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm"
                  >
                    {QUOTE_STATUSES.map(
                      (item) => (
                        <option
                          key={
                            item.key
                          }
                          value={
                            item.key
                          }
                        >
                          {
                            item.label
                          }
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              </div>
            ) : null}

            <TicketHistory
              history={
                selectedTicket.history ||
                []
              }
            />

            <div className="flex flex-wrap justify-between gap-2 border-t border-[#eadcc9] pt-4">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-red-200 text-red-700"
                onClick={() =>
                  deleteTicket(
                    selectedTicket.id,
                  )
                }
              >
                Supprimer
              </Button>

              <div className="flex flex-wrap gap-2">
                {selectedTicket.status !==
                "NOUVEAU" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl border-[#d8c4ad] text-[#5b351f]"
                    onClick={() =>
                      openTransition(
                        selectedTicket,
                        "PREVIOUS",
                      )
                    }
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Étape précédente
                  </Button>
                ) : null}

                {selectedTicket.status !==
                "CLOTURE" ? (
                  <Button
                    type="button"
                    className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"
                    onClick={() =>
                      openTransition(
                        selectedTicket,
                        "NEXT",
                      )
                    }
                  >
                    Passer à l’étape suivante
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {transitionTicket ? (
        <Modal
          title={`${
            transitionDirection === "PREVIOUS"
              ? "Revenir à"
              : "Passer à"
          } l’étape « ${getStatusLabel(
            transitionDirection === "PREVIOUS"
              ? previousStatus(
                  transitionTicket.status,
                )
              : nextStatus(
                  transitionTicket.status,
                ),
          )} »`}
          onClose={closeTransition}
        >
          <form
            className="space-y-5"
            onSubmit={
              confirmTransition
            }
          >
            <div className="rounded-2xl border border-[#eadcc9] bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[#9a8571]">
                Transition
              </div>

              <div className="mt-1 font-bold text-[#2d1b12]">
                {getStatusLabel(
                  transitionTicket.status,
                )}
                {" → "}
                {getStatusLabel(
                  transitionDirection === "PREVIOUS"
                    ? previousStatus(
                        transitionTicket.status,
                      )
                    : nextStatus(
                        transitionTicket.status,
                      ),
                )}
              </div>
            </div>

            {transitionDirection === "NEXT" &&
            nextStatus(
              transitionTicket.status,
            ) === "PLANIFIE" ? (
              <div className="space-y-4 rounded-2xl border border-[#e5c89f] bg-[#fff3e5] p-4">
                <div>
                  <div className="font-bold text-[#2d1b12]">
                    Planification de l’intervention
                  </div>
                  <p className="mt-1 text-xs text-[#7a5f4b]">
                    Ce créneau alimentera automatiquement le Planning SAV.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Date d’intervention *">
                    <Input
                      type="date"
                      value={
                        transitionForm.plannedRepairDate
                      }
                      onChange={(event) =>
                        setTransitionForm(
                          (current) => ({
                            ...current,
                            plannedRepairDate:
                              event.target.value,
                          }),
                        )
                      }
                      required
                    />
                  </Field>

                  <Field label="Heure de début *">
                    <Input
                      type="time"
                      value={
                        transitionForm.plannedRepairTime
                      }
                      onChange={(event) =>
                        setTransitionForm(
                          (current) => ({
                            ...current,
                            plannedRepairTime:
                              event.target.value,
                          }),
                        )
                      }
                      required
                    />
                  </Field>

                  <Field label="Durée estimée *">
                    <select
                      value={
                        transitionForm.durationMinutes
                      }
                      onChange={(event) =>
                        setTransitionForm(
                          (current) => ({
                            ...current,
                            durationMinutes:
                              event.target.value,
                          }),
                        )
                      }
                      className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm"
                      required
                    >
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1 h</option>
                      <option value="90">1 h 30</option>
                      <option value="120">2 h</option>
                      <option value="180">3 h</option>
                      <option value="240">4 h</option>
                    </select>
                  </Field>

                  <Field label="Technicien *">
                    <select
                      value={transitionForm.technicianId}
                      onChange={(event) => {
                        const technician = technicians.find(
                          (item) => item.id === event.target.value,
                        );

                        setTransitionForm(
                          (current) => ({
                            ...current,
                            technicianId: event.target.value,
                            technician: technician?.displayName || "",
                          }),
                        );
                      }}
                      className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm"
                      required
                    >
                      <option value="">Sélectionner un technicien</option>
                      {technicians.map((technician) => (
                        <option
                          key={technician.id}
                          value={technician.id}
                        >
                          {technician.displayName}
                        </option>
                      ))}
                    </select>
                    {techniciansError ? (
                      <p className="mt-1 text-xs text-red-700">
                        {techniciansError}
                      </p>
                    ) : null}
                  </Field>

                  <Field label="Type de lieu">
                    <select
                      value={
                        transitionForm.locationType
                      }
                      onChange={(event) =>
                        setTransitionForm(
                          (current) => ({
                            ...current,
                            locationType:
                              event.target.value,
                          }),
                        )
                      }
                      className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-white px-4 text-sm"
                    >
                      <option value="ATELIER">Atelier LPB</option>
                      <option value="CLIENT">Chez le client</option>
                      <option value="AUTRE">Autre lieu</option>
                    </select>
                  </Field>

                  <Field label="Lieu / précision">
                    <Input
                      value={
                        transitionForm.locationLabel
                      }
                      onChange={(event) =>
                        setTransitionForm(
                          (current) => ({
                            ...current,
                            locationLabel:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder={
                        transitionForm.locationType === "CLIENT"
                          ? "Adresse ou établissement"
                          : "Ex : Atelier Longvic"
                      }
                    />
                  </Field>
                </div>

                <p className="text-xs text-[#7a5f4b]">
                  La date restera également visible sur le ticket pour pouvoir répondre rapidement au client.
                </p>
              </div>
            ) : null}

            <Field
              label={
                transitionDirection === "PREVIOUS"
                  ? "Commentaire / motif du retour *"
                  : "Commentaire / motif du changement *"
              }
            >
              <Textarea
                value={
                  transitionForm.comment
                }
                onChange={(event) =>
                  setTransitionForm(
                    (current) => ({
                      ...current,
                      comment:
                        event.target.value,
                    }),
                  )
                }
                placeholder={
                  transitionDirection === "PREVIOUS"
                    ? "Expliquer pourquoi le ticket revient à l’étape précédente..."
                    : "Expliquer pourquoi le ticket passe à l’étape suivante..."
                }
                rows={4}
                required
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={
                  closeTransition
                }
                className="rounded-2xl"
              >
                Annuler
              </Button>

              <Button
                type="submit"
                className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"
              >
                {transitionDirection === "PREVIOUS"
                  ? "Valider le retour"
                  : "Valider le changement"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function TicketHistory({
  history,
}) {
  const ordered = [...history].sort(
    (a, b) =>
      new Date(b.createdAt) -
      new Date(a.createdAt),
  );

  return (
    <div className="rounded-2xl border border-[#d8c4ad] bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <History className="h-5 w-5 text-[#9a6b46]" />

        <div>
          <div className="font-bold text-[#2d1b12]">
            Historique SAV
          </div>

          <div className="text-xs text-[#7a5f4b]">
            Chaque changement
            d’étape est conservé.
          </div>
        </div>
      </div>

      {!ordered.length ? (
        <div className="rounded-xl border border-dashed border-[#d8c4ad] p-4 text-center text-sm text-[#9a8571]">
          Aucun événement
          enregistré.
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map(
            (item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#eadcc9] bg-[#fffaf3] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-semibold text-[#2d1b12]">
                    {item.label}
                  </div>

                  <div className="text-xs text-[#9a8571]">
                    {formatDateTime(
                      item.createdAt,
                    )}
                  </div>
                </div>

                {item.comment ? (
                  <div className="mt-2 flex items-start gap-2 text-sm text-[#7a5f4b]">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />

                    <span>
                      {
                        item.comment
                      }
                    </span>
                  </div>
                ) : null}

                {item.metadata?.scheduledStart ? (
                  <div className="mt-2 rounded-lg bg-[#fff3e5] px-3 py-2 text-xs text-[#5b351f]">
                    <div className="font-bold">
                      Créneau : {formatDateTime(item.metadata.scheduledStart)}
                      {item.metadata?.scheduledEnd
                        ? ` → ${formatTime(item.metadata.scheduledEnd)}`
                        : ""}
                    </div>
                    {item.metadata?.technician ? (
                      <div className="mt-1">
                        Technicien : {item.metadata.technician}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {item.plannedRepairDate &&
                item.toStatus ===
                  "PLANIFIE" ? (
                  <div className="mt-2 text-xs font-semibold text-[#5b351f]">
                    Date planifiée :{" "}
                    {formatDate(
                      item.plannedRepairDate,
                    )}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  danger = false,
}) {
  return (
    <Card className="rounded-3xl border-[#d8c4ad] bg-white shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs text-[#7a5f4b]">
            {title}
          </p>

          <p
            className={`mt-1 text-3xl font-black ${
              danger
                ? "text-red-700"
                : "text-[#2d1b12]"
            }`}
          >
            {value}
          </p>
        </div>

        <div
          className={`rounded-2xl p-3 ${
            danger
              ? "bg-red-50"
              : "bg-[#f0dfcd]"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${
              danger
                ? "text-red-700"
                : "text-[#5b351f]"
            }`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Modal({
  title,
  onClose,
  children,
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <Card
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-2xl"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#eadcc9]">
          <CardTitle className="text-xl text-[#2d1b12]">
            {title}
          </CardTitle>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-[#f0dfcd]"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="p-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#5b351f]">
        {label}
      </span>

      {children}
    </label>
  );
}

function Info({
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-[#eadcc9] bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-[#9a8571]">
        {label}
      </div>

      <div className="mt-1 font-semibold text-[#2d1b12]">
        {value}
      </div>
    </div>
  );
}