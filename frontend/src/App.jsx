import React, { useEffect, useMemo, useState } from "react";
import {
  Package, UserRound, Wrench, Search, Plus, ArrowRightLeft, MapPin,
  CalendarDays, Building2, RefreshCw, Link2, ShieldCheck, PlugZap,
  Boxes, Wifi, WifiOff, Download, Printer, Trash2,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { QRCodeSVG } from "qrcode.react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || "change-me";
const LOGIN_USERNAME = import.meta.env.VITE_LOGIN_USERNAME || "admin";
const LOGIN_PASSWORD = import.meta.env.VITE_LOGIN_PASSWORD || "";
const LOGIN_STORAGE_KEY = "lpb-machines-auth";
const LABEL_STORAGE_KEY = "lpb-machines-label-settings";

const STATUSES = [
  "En stock",
  "En préparation",
  "En prêt",
  "En location",
  "Vendue",
  "En maintenance",
  "Hors service",
];

async function apiFetch(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ADMIN_API_KEY,
        ...(options.headers || {}),
      },
    });

    let body = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      console.error("API ERROR", { path, status: response.status, body });
      throw new Error(body?.message || body?.error || `Erreur API ${response.status}`);
    }

    return body;
  } catch (error) {
    console.error("FETCH ERROR", error);
    throw new Error(error?.message || "Erreur réseau ou backend inaccessible.");
  }
}

async function publicApiFetch(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let body = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      console.error("PUBLIC API ERROR", { path, status: response.status, body });
      throw new Error(body?.message || body?.error || `Erreur API ${response.status}`);
    }

    return body;
  } catch (error) {
    console.error("PUBLIC FETCH ERROR", error);
    throw new Error(error?.message || "Erreur réseau ou backend inaccessible.");
  }
}

function getRouteInfo() {
  const path = window.location.pathname || "/";
  const match = path.match(/^\/machine\/([^/]+)$/);

  return {
    isMachineRoute: Boolean(match),
    machineCode: match ? decodeURIComponent(match[1]) : "",
  };
}

function getMachineCode(machine) {
  return machine?.code || machine?.idCode || machine?.machineCode || machine?.id || "";
}

function getMachineApiId(machine) {
  return machine?.uuid || machine?.id || getMachineCode(machine);
}

function getMachinePublicUrl(machine) {
  const code = getMachineCode(machine);
  return `${window.location.origin}/machine/${encodeURIComponent(code)}`;
}

function formatDate(date) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString("fr-FR");
}

function formatAmount(value) {
  if (value === undefined || value === null || value === "") return "-";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value));
}

function fillGpsLocation(setLocation, setMessage) {
  if (!navigator.geolocation) {
    if (setMessage) setMessage("La géolocalisation n'est pas disponible sur cet appareil.");
    return;
  }

  if (setMessage) setMessage("Recherche de la position GPS…");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(5);
      const lon = position.coords.longitude.toFixed(5);
      setLocation(`GPS ${lat}, ${lon}`);
      if (setMessage) setMessage("Position GPS ajoutée dans le lieu.");
    },
    () => {
      if (setMessage) setMessage("Impossible de récupérer la position GPS.");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }
  );
}

function statusVariant(status) {
  switch (status) {
    case "En stock":
      return "secondary";
    case "En location":
    case "En prêt":
      return "default";
    case "Vendue":
      return "outline";
    case "En maintenance":
    case "Hors service":
      return "destructive";
    default:
      return "secondary";
  }
}

async function downloadQRCode(url, code) {
  const qrDataUrl = await QRCodeLib.toDataURL(url, {
    width: 1024,
    margin: 2,
  });

  const link = document.createElement("a");
  link.href = qrDataUrl;
  link.download = `QR-${code}.png`;
  link.click();
}

function printQRCode(machine) {
  const code = getMachineCode(machine);
  const url = getMachinePublicUrl(machine);

  const printWindow = window.open("", "_blank", "width=600,height=800");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>QR ${code}</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
          .card { border: 1px solid #ddd; border-radius: 16px; padding: 32px; display: inline-block; }
          img { width: 260px; height: 260px; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          p { margin: 6px 0; color: #444; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${code}</h1>
          <p>${machine?.marque || ""} ${machine?.modele || ""}</p>
          <canvas id="qr"></canvas>
          <p>${url}</p>
        </div>
        <script type="module">
          import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
          QRCode.toCanvas(document.getElementById("qr"), "${url}", { width: 260 }, function () {
            window.print();
          });
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

export default function App() {
  const routeInfo = getRouteInfo();
const [isAuthenticated, setIsAuthenticated] = useState(
  localStorage.getItem(LOGIN_STORAGE_KEY) === "true"
);
const [loginUsername, setLoginUsername] = useState("");
const [loginPassword, setLoginPassword] = useState("");
const [loginError, setLoginError] = useState("");

function handleLogin(event) {
  event.preventDefault();

  if (loginUsername === LOGIN_USERNAME && loginPassword === LOGIN_PASSWORD) {
    localStorage.setItem(LOGIN_STORAGE_KEY, "true");
    setIsAuthenticated(true);
    setLoginError("");
    return;
  }

  setLoginError("Identifiant ou mot de passe incorrect.");
}

function handleLogout() {
  localStorage.removeItem(LOGIN_STORAGE_KEY);
  setIsAuthenticated(false);
}
  const [clients, setClients] = useState([]);
  const [machines, setMachines] = useState([]);
  const [movements, setMovements] = useState([]);

  const [pennylaneStatus, setPennylaneStatus] = useState({ connected: false, lastSyncAt: "" });
  const [pennylaneCustomers, setPennylaneCustomers] = useState([]);
  const [pennylaneProducts, setPennylaneProducts] = useState([]);
  const [pennylaneInvoices, setPennylaneInvoices] = useState([]);

  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [clientFilter, setClientFilter] = useState("Tous");
  const [activeTab, setActiveTab] = useState("fiche");

  const [showMachineForm, setShowMachineForm] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [machineForm, setMachineForm] = useState({
    marque: "",
    modele: "",
    numeroSerie: "",
    fournisseur: "",
    dateAchat: "",
    factureAchat: "",
    prixAchat: "",
    lieu: "Entrepôt A",
    commentaire: "",
  });

  const [labelSettings, setLabelSettings] = useState(() => {
    const saved = localStorage.getItem(LABEL_STORAGE_KEY);

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        localStorage.removeItem(LABEL_STORAGE_KEY);
      }
    }

    return {
      width: 85,
      height: 32,
      borderRadius: 6,
      company1: "SAS LPB TORREFACTION",
      company2: "7 D Boulevard Eiffel",
      company3: "21600 LONGVIC",
      company4: "03.80.54.39.40",
      showBorder: true,
      showQr: true,
      showMachineCode: true,
      showModel: true,
      showCompany: true,
    };
  });

  const [actionStatus, setActionStatus] = useState("En stock");
  const [actionClientId, setActionClientId] = useState("");
  const [actionLocation, setActionLocation] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [maintenanceStartDate, setMaintenanceStartDate] = useState("");
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [maintenanceAction, setMaintenanceAction] = useState("");
  const [maintenanceExpectedReturnDate, setMaintenanceExpectedReturnDate] = useState("");
  const [actionPennylaneCustomerId, setActionPennylaneCustomerId] = useState("");


  async function loadAllData() {
    try {
      setErrorMessage("");
      setIsLoading(true);

      if (routeInfo.isMachineRoute) {
        const [machineData, historyData, clientsData] = await Promise.all([
          publicApiFetch(`/public/machines/${routeInfo.machineCode}`),
          publicApiFetch(`/public/machines/${routeInfo.machineCode}/movements`),
          apiFetch("/clients"),
        ]);

        setMachines([machineData]);
        setMovements(historyData);
        setClients(clientsData);
        setSelectedMachineId(getMachineApiId(machineData));
        return;
      }

      const [
        machinesData,
        clientsData,
        pennylaneStatusData,
        pennylaneCustomersData,
        pennylaneProductsData,
        pennylaneInvoicesData,
      ] = await Promise.all([
        apiFetch("/machines"),
        apiFetch("/clients"),
        apiFetch("/pennylane/status"),
        apiFetch("/pennylane/customers"),
        apiFetch("/pennylane/products"),
        apiFetch("/pennylane/invoices"),
      ]);

      setMachines(machinesData);
      setClients(clientsData);
      setPennylaneStatus(pennylaneStatusData);
      setPennylaneCustomers(pennylaneCustomersData);
      setPennylaneProducts(pennylaneProductsData);
      setPennylaneInvoices(pennylaneInvoicesData);

      const idToSelect = getMachineApiId(machinesData[0]) || "";

      if (idToSelect) {
        setSelectedMachineId(idToSelect);
        setMovements(await apiFetch(`/machines/${idToSelect}/movements`));
      } else {
        setMovements([]);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(labelSettings));
  }, [labelSettings]);

  const selectedMachine = useMemo(() => {
    if (routeInfo.isMachineRoute) {
      return (
        machines.find((m) => {
          const code = getMachineCode(m);
          return code === routeInfo.machineCode || m.uuid === routeInfo.machineCode;
        }) || null
      );
    }

    return (
      machines.find((m) => {
        const apiId = getMachineApiId(m);
        return apiId === selectedMachineId || getMachineCode(m) === selectedMachineId;
      }) ||
      machines[0] ||
      null
    );
  }, [machines, selectedMachineId, routeInfo.isMachineRoute, routeInfo.machineCode]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedMachine?.clientId) || null,
    [clients, selectedMachine]
  );

  const selectedPennylaneCustomer = useMemo(
    () =>
      pennylaneCustomers.find(
        (customer) =>
          String(customer.id) ===
          String(selectedMachine?.pennylaneCustomerId || ""),
      ) || null,
    [pennylaneCustomers, selectedMachine],
  );

  const selectedPennylaneProduct = useMemo(
    () => pennylaneProducts.find((p) => p.id === selectedMachine?.pennylaneProductId) || null,
    [pennylaneProducts, selectedMachine]
  );

  const selectedPurchaseInvoice = useMemo(
    () => pennylaneInvoices.find((invoice) => invoice.id === selectedMachine?.pennylanePurchaseInvoiceId) || null,
    [pennylaneInvoices, selectedMachine]
  );

  const selectedSalesInvoice = useMemo(
    () => pennylaneInvoices.find((invoice) => invoice.id === selectedMachine?.pennylaneSalesInvoiceId) || null,
    [pennylaneInvoices, selectedMachine]
  );

  const machineHistory = useMemo(() => {
    if (!selectedMachine) return [];

    return movements
      .filter((m) => !m.machineId || m.machineId === selectedMachine.uuid)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [movements, selectedMachine]);

  useEffect(() => {
    if (!selectedMachine) return;

    setActionStatus(selectedMachine.statut || "En stock");
    setActionClientId(selectedMachine.clientId || "");
    setActionLocation(selectedMachine.lieu || "");
    setActionComment("");
    setMaintenanceStartDate(selectedMachine.maintenanceStartDate || "");
    setMaintenanceReason(selectedMachine.maintenanceReason || "");
    setMaintenanceAction(selectedMachine.maintenanceAction || "");
    setMaintenanceExpectedReturnDate(selectedMachine.maintenanceExpectedReturnDate || "");
    setActionPennylaneCustomerId(selectedMachine.pennylaneCustomerId || "");
  }, [selectedMachine]);

  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      const client = clients.find((c) => c.id === machine.clientId);
      const product = pennylaneProducts.find((p) => p.id === machine.pennylaneProductId);

      const haystack = [
        getMachineCode(machine),
        machine.marque,
        machine.modele,
        machine.numeroSerie,
        client?.nom || "",
        product?.label || "",
      ].join(" ").toLowerCase();

      return (
        haystack.includes(search.toLowerCase()) &&
        (statusFilter === "Tous" || machine.statut === statusFilter) &&
        (
          clientFilter === "Tous" ||
          (clientFilter === "Sans client" && !machine.clientId) ||
          machine.clientId === clientFilter
        )
      );
    });
  }, [machines, clients, pennylaneProducts, search, statusFilter, clientFilter]);

  const stats = useMemo(() => ({
    total: machines.length,
    stock: machines.filter((m) => m.statut === "En stock").length,
    enClient: machines.filter((m) => ["En location", "En prêt", "Vendue"].includes(m.statut)).length,
    maintenance: machines.filter((m) => m.statut === "En maintenance").length,
  }), [machines]);

  async function connectPennylane() {
    try {
      setErrorMessage("");
      setPennylaneStatus(await apiFetch("/pennylane/connect", { method: "POST" }));
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
    }
  }

  async function syncPennylaneData() {
    try {
      setErrorMessage("");
      setIsSyncing(true);
      const result = await apiFetch("/pennylane/sync/customers", { method: "POST" });
      setPennylaneStatus({ connected: true, lastSyncAt: result.lastSyncAt || "" });
      await loadAllData();
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
    } finally {
      setIsSyncing(false);
    }
  }

  

  async function createMachine() {
    try {
      setErrorMessage("");

      const createdMachine = await apiFetch("/machines", {
        method: "POST",
        body: JSON.stringify(machineForm),
      });

      const createdId = getMachineApiId(createdMachine);
      setMachines((prev) => [createdMachine, ...prev]);
      setSelectedMachineId(createdId);
      setMovements(await apiFetch(`/machines/${createdId}/movements`));

      setMachineForm({
        marque: "",
        modele: "",
        numeroSerie: "",
        fournisseur: "",
        dateAchat: "",
        factureAchat: "",
        prixAchat: "",
        lieu: "Entrepôt A",
        commentaire: "",
      });

      setShowMachineForm(false);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
    }
  }

  async function applyAction() {
    if (!selectedMachine) return;

    try {
      setErrorMessage("");

      const clientRequiredStatuses = [
        "En prêt",
        "En location",
        "Vendue",
      ];

      const clientIsRequired =
        clientRequiredStatuses.includes(actionStatus);

      if (clientIsRequired && !actionPennylaneCustomerId) {
        setErrorMessage(
          `Un client doit être sélectionné lorsque le statut est « ${actionStatus} ».`,
        );
        return;
      }

      const matchingLocalClient = clients.find(
        (client) =>
          String(client.pennylaneCustomerId || "") ===
          String(actionPennylaneCustomerId || ""),
      );

      const resolvedClientId = matchingLocalClient?.id ?? null;
      const apiId = getMachineApiId(selectedMachine);

      const updatedMachine = await apiFetch(`/machines/${apiId}`, {
        method: "PATCH",
        body: JSON.stringify({
          statut: actionStatus,
          clientId: resolvedClientId,
          pennylaneCustomerId: actionPennylaneCustomerId || null,
          lieu: actionLocation || "",
          commentaire:
            actionComment || selectedMachine.commentaire || "",
          maintenanceStartDate: maintenanceStartDate || null,
          maintenanceReason: maintenanceReason || null,
          maintenanceAction: maintenanceAction || null,
          maintenanceExpectedReturnDate:
            maintenanceExpectedReturnDate || null,
          action: "Mise à jour",
        }),
      });

      setMachines((previousMachines) =>
        previousMachines.map((machine) =>
          getMachineApiId(machine) === apiId
            ? updatedMachine
            : machine,
        ),
      );

      setMovements(await apiFetch(`/machines/${apiId}/movements`));
      setActionClientId(updatedMachine.clientId || "");
      setActionPennylaneCustomerId(
        updatedMachine.pennylaneCustomerId || "",
      );
      setActionComment("");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
    }
  }

  async function deleteSelectedMachine() {
    if (!selectedMachine) return;

    const machineCode = getMachineCode(selectedMachine);
    const confirmed = window.confirm(
      `Supprimer définitivement la machine ${machineCode} et tout son historique ?`,
    );

    if (!confirmed) return;

    try {
      setErrorMessage("");
      const apiId = getMachineApiId(selectedMachine);

      await apiFetch(`/machines/${apiId}`, {
        method: "DELETE",
      });

      const remainingMachines = machines.filter(
        (machine) => getMachineApiId(machine) !== apiId,
      );

      setMachines(remainingMachines);
      setMovements([]);

      const nextMachine = remainingMachines[0] || null;
      const nextMachineId = nextMachine ? getMachineApiId(nextMachine) : "";
      setSelectedMachineId(nextMachineId);

      if (nextMachineId) {
        setMovements(await apiFetch(`/machines/${nextMachineId}/movements`));
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
    }
  }

  async function refreshMachine(machineCode) {
    const [machineData, historyData, clientsData] = await Promise.all([
      publicApiFetch(`/public/machines/${machineCode}`),
      publicApiFetch(`/public/machines/${machineCode}/movements`),
      apiFetch("/clients"),
    ]);

    setMachines([machineData]);
    setMovements(historyData);
    setClients(clientsData);
    setSelectedMachineId(getMachineApiId(machineData));
  }

if (!isAuthenticated) {
  return (
    <LoginPage
      username={loginUsername}
      password={loginPassword}
      error={loginError}
      setUsername={setLoginUsername}
      setPassword={setLoginPassword}
      onLogin={handleLogin}
    />
  );
}

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4eadc] p-6">
        <Card className="mx-auto max-w-7xl rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
          <CardContent className="p-8 text-sm text-[#7a5f4b]">
            Chargement des données depuis l’API…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (routeInfo.isMachineRoute) {
    return (
      <MachinePublicPage
        machine={selectedMachine}
        client={selectedClient}
        history={machineHistory}
        clients={clients}
        errorMessage={errorMessage}
        onRefreshMachine={refreshMachine}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f4eadc] text-[#2d1b12]">
      <div className="min-h-screen">
       

          <main className="w-full">
          <header className="bg-[#5b351f] px-5 py-6 text-white md:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">LPB Machines</h1>
                <p className="mt-1 text-sm text-[#eadcc9]">Gestion du parc machines · Supabase · Pennylane</p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex h-12 min-w-[320px] items-center gap-3 rounded-2xl bg-white px-4 text-[#2d1b12] shadow-sm">
                  <Search className="h-5 w-5 text-[#7a5f4b]" />
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-[#9a8571]"
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="rounded-2xl bg-white px-5 py-3 text-sm text-[#5b351f] shadow-sm">
                  <div className="text-xs text-[#7a5f4b]">Connexion</div>
                  <div className="font-bold">
                    {pennylaneStatus.connected ? "Pennylane connecté" : "Pennylane non connecté"}
                  </div>
                </div>

<Button
  variant="outline"
  className="rounded-2xl border-white bg-white text-[#5b351f] hover:bg-[#f0dfcd]"
  onClick={handleLogout}
>
  Déconnexion
</Button>
              </div>
            </div>
          </header>

          <div className="space-y-6 p-5 md:p-8">
            {errorMessage ? (
              <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">
                <CardContent className="p-4 text-sm text-red-700">{errorMessage}</CardContent>
              </Card>
            ) : null}

            <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className={`rounded-2xl p-3 ${pennylaneStatus.connected ? "bg-emerald-100" : "bg-[#f0dfcd]"}`}>
                    {pennylaneStatus.connected ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    ) : (
                      <PlugZap className="h-5 w-5 text-[#5b351f]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-lg font-bold text-[#2d1b12]">
                      Connexion Pennylane
                      {pennylaneStatus.connected ? (
                        <Wifi className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-[#9a8571]" />
                      )}
                    </div>
                    <p className="text-sm text-[#7a5f4b]">
                      {pennylaneStatus.connected
                        ? `Connecté. Dernière synchronisation : ${pennylaneStatus.lastSyncAt || "jamais"}`
                        : "Non connecté. Clique pour simuler le branchement OAuth."}
                    </p>
                  </div>
                </div>

                {!pennylaneStatus.connected ? (
                  <Button className="rounded-2xl bg-[#5b351f] px-5 text-white hover:bg-[#3f2415]" onClick={connectPennylane}>
                    <PlugZap className="mr-2 h-4 w-4" />
                    Connecter Pennylane
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-2xl border-[#5b351f] bg-[#fffdf8] px-5 text-[#5b351f] hover:bg-[#f0dfcd]"
                    onClick={syncPennylaneData}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                    Synchroniser
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Machines" value={stats.total} icon={Package} />
              <StatCard title="En stock" value={stats.stock} icon={Building2} />
              <StatCard title="Chez clients" value={stats.enClient} icon={UserRound} />
              <StatCard title="Maintenance" value={stats.maintenance} icon={Wrench} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_1.95fr]">
              <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl text-[#2d1b12]">Parc machines</CardTitle>
                      <p className="text-sm text-[#7a5f4b]">Gestion locale connectée à Supabase.</p>
                    </div>

                    <div className="flex gap-2">
                     
                      <Button className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]" onClick={() => setShowMachineForm((v) => !v)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>
                  </div>

                  

                  {showMachineForm ? (
                    <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffdf8] shadow-none">
                      <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                        <Field label="Marque"><Input value={machineForm.marque} onChange={(e) => setMachineForm({ ...machineForm, marque: e.target.value })} /></Field>
                        <Field label="Modèle"><Input value={machineForm.modele} onChange={(e) => setMachineForm({ ...machineForm, modele: e.target.value })} /></Field>
                        <Field label="N° série"><Input value={machineForm.numeroSerie} onChange={(e) => setMachineForm({ ...machineForm, numeroSerie: e.target.value })} /></Field>
                        <Field label="Fournisseur"><Input value={machineForm.fournisseur} onChange={(e) => setMachineForm({ ...machineForm, fournisseur: e.target.value })} /></Field>
                        <Field label="Date achat"><Input type="date" value={machineForm.dateAchat} onChange={(e) => setMachineForm({ ...machineForm, dateAchat: e.target.value })} /></Field>
                        <Field label="Prix achat"><Input type="number" value={machineForm.prixAchat} onChange={(e) => setMachineForm({ ...machineForm, prixAchat: e.target.value })} /></Field>
                        <Field label="Facture achat"><Input value={machineForm.factureAchat} onChange={(e) => setMachineForm({ ...machineForm, factureAchat: e.target.value })} /></Field>
                        <Field label="Lieu"><Input value={machineForm.lieu} onChange={(e) => setMachineForm({ ...machineForm, lieu: e.target.value })} /></Field>


                        <Field label="Commentaire" className="md:col-span-2"><Textarea value={machineForm.commentaire} onChange={(e) => setMachineForm({ ...machineForm, commentaire: e.target.value })} /></Field>

                        <div className="md:col-span-2">
                          <Button onClick={createMachine} className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]">Créer la machine</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="grid gap-2 md:grid-cols-2">
                    <Select value={statusFilter} onChange={setStatusFilter}>
                      <option value="Tous">Tous les statuts</option>
                      {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </Select>

                    <Select value={clientFilter} onChange={setClientFilter}>
                      <option value="Tous">Tous les clients</option>
                      <option value="Sans client">Sans client</option>
                      {clients.map((client) => <option key={client.id} value={client.id}>{client.nom}</option>)}
                    </Select>
                  </div>
                </CardHeader>

                <CardContent>
                  <ScrollArea className="h-[620px] pr-3">
                    <div className="space-y-3">
                      {filteredMachines.map((machine) => {
                        const client = clients.find((c) => c.id === machine.clientId);
                        const selected = getMachineApiId(machine) === getMachineApiId(selectedMachine);

                        return (
                          <button
                            key={getMachineApiId(machine)}
                            onClick={async () => {
                              try {
                                const apiId = getMachineApiId(machine);
                                setSelectedMachineId(apiId);
                                setMovements(await apiFetch(`/machines/${apiId}/movements`));
                              } catch (error) {
                                console.error(error);
                                setErrorMessage(error.message);
                              }
                            }}
                            className={`w-full rounded-3xl border bg-[#fffdf8] p-4 text-left shadow-sm transition hover:border-[#5b351f] hover:bg-[#f7eddf] ${
                              selected ? "border-[#5b351f] ring-2 ring-[#eadcc9]" : "border-[#e4d4c2]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-[#2d1b12]">{getMachineCode(machine)}</div>
                                <div className="text-sm text-[#7a5f4b]">{machine.marque} {machine.modele}</div>
                                <div className="mt-1 text-xs text-[#9a8571]">{client?.nom || "Sans client"}</div>
                              </div>
                             <Badge
  variant={statusVariant(
    selectedMachine?.id === machine.id
      ? actionStatus
      : machine.statut
  )}
>
  {selectedMachine?.id === machine.id
    ? actionStatus
    : machine.statut}
</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <MachineDetailPanel
                machine={selectedMachine}
                client={selectedClient}
                pennylaneCustomer={selectedPennylaneCustomer}
                pennylaneProduct={selectedPennylaneProduct}
                purchaseInvoice={selectedPurchaseInvoice}
                salesInvoice={selectedSalesInvoice}
                history={machineHistory}
                pennylaneCustomers={pennylaneCustomers}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                actionStatus={actionStatus}
                setActionStatus={setActionStatus}
                actionLocation={actionLocation}
                setActionLocation={setActionLocation}
                actionComment={actionComment}
                setActionComment={setActionComment}
                maintenanceStartDate={maintenanceStartDate}
                setMaintenanceStartDate={setMaintenanceStartDate}
                maintenanceReason={maintenanceReason}
                setMaintenanceReason={setMaintenanceReason}
                maintenanceAction={maintenanceAction}
                setMaintenanceAction={setMaintenanceAction}
                maintenanceExpectedReturnDate={maintenanceExpectedReturnDate}
                setMaintenanceExpectedReturnDate={setMaintenanceExpectedReturnDate}
                actionPennylaneCustomerId={actionPennylaneCustomerId}
                setActionPennylaneCustomerId={setActionPennylaneCustomerId}
                onApplyAction={applyAction}
                onDeleteMachine={deleteSelectedMachine}
                labelSettings={labelSettings}
                setLabelSettings={setLabelSettings}
                errorMessage={errorMessage}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MachineDetailPanel({
  machine, pennylaneCustomer, pennylaneProduct, purchaseInvoice, salesInvoice,
  history, pennylaneCustomers, activeTab, setActiveTab,
  actionStatus, setActionStatus, actionLocation, setActionLocation,
  actionComment, setActionComment, maintenanceStartDate, setMaintenanceStartDate,
  maintenanceReason, setMaintenanceReason, maintenanceAction, setMaintenanceAction,
  maintenanceExpectedReturnDate, setMaintenanceExpectedReturnDate, actionPennylaneCustomerId,
  setActionPennylaneCustomerId, onApplyAction, onDeleteMachine, labelSettings, setLabelSettings,
  errorMessage,
}) {
  if (!machine) {
    return (
      <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
        <CardContent className="p-8 text-sm text-[#7a5f4b]">Aucune machine sélectionnée.</CardContent>
      </Card>
    );
  }

  const code = getMachineCode(machine);
  const publicUrl = getMachinePublicUrl(machine);

  return (
    <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-2xl text-[#2d1b12]">{code}</CardTitle>
            <p className="text-[#7a5f4b]">{machine.marque} {machine.modele}</p>
<div className="mt-2">
  <Badge variant={statusVariant(actionStatus)}>{actionStatus}</Badge>
</div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            onClick={onDeleteMachine}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer la machine
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton active={activeTab === "fiche"} onClick={() => setActiveTab("fiche")}>Fiche</TabButton>
          <TabButton active={activeTab === "terrain"} onClick={() => setActiveTab("terrain")}>Mise à jour terrain</TabButton>
          <TabButton active={activeTab === "historique"} onClick={() => setActiveTab("historique")}>Historique</TabButton>
          <TabButton active={activeTab === "qr"} onClick={() => setActiveTab("qr")}>QR page</TabButton>
          <TabButton active={activeTab === "etiquette"} onClick={() => setActiveTab("etiquette")}>Étiquette QR</TabButton>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {activeTab === "fiche" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Info
              label="Client Pennylane"
              value={pennylaneCustomer?.name || pennylaneCustomer?.label || "Sans client"}
              icon={UserRound}
            />
            <Info label="Lieu" value={machine.lieu || "-"} icon={MapPin} />
            <Info label="N° série" value={machine.numeroSerie || "-"} icon={Boxes} />
            <Info label="Date achat" value={formatDate(machine.dateAchat)} icon={CalendarDays} />
            <Info label="Fournisseur" value={machine.fournisseur || "-"} icon={Building2} />
            <Info label="Prix achat" value={formatAmount(machine.prixAchat)} icon={Package} />
            <Info label="Date mise à disposition" value={formatDate(machine.dateMiseDisposition)} icon={CalendarDays} />
            <Info label="Début maintenance" value={formatDate(machine.maintenanceStartDate)} icon={Wrench} />
            <Info label="Retour maintenance prévu" value={formatDate(machine.maintenanceExpectedReturnDate)} icon={CalendarDays} />
            <Info label="Facture achat" value={machine.factureAchat || "-"} icon={Link2} />
            {machine.maintenanceReason ? (
              <div className="md:col-span-2">
                <Info label="Motif maintenance" value={machine.maintenanceReason} icon={Wrench} />
              </div>
            ) : null}
            {machine.maintenanceAction ? (
              <div className="md:col-span-2">
                <Info label="Action maintenance" value={machine.maintenanceAction} icon={Wrench} />
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Info label="Commentaire" value={machine.commentaire || "-"} icon={Wrench} />
            </div>
          </div>
        ) : null}

        {activeTab === "terrain" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Statut"><Select value={actionStatus} onChange={setActionStatus}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</Select></Field>

            {actionStatus === "En maintenance" ? (
              <>
                <Field label="Date début maintenance">
                  <Input type="date" value={maintenanceStartDate} onChange={(e) => setMaintenanceStartDate(e.target.value)} />
                </Field>

                <Field label="Retour prévu">
                  <Input type="date" value={maintenanceExpectedReturnDate} onChange={(e) => setMaintenanceExpectedReturnDate(e.target.value)} />
                </Field>

                <Field label="Motif / panne" className="md:col-span-2">
                  <Textarea
                    value={maintenanceReason}
                    onChange={(e) => setMaintenanceReason(e.target.value)}
                    placeholder="Ex : fuite, broyeur bloqué, détartrage..."
                  />
                </Field>

                <Field label="Action réalisée" className="md:col-span-2">
                  <Textarea
                    value={maintenanceAction}
                    onChange={(e) => setMaintenanceAction(e.target.value)}
                    placeholder="Ex : nettoyage, changement joint, test OK..."
                  />
                </Field>
              </>
            ) : null}
            
            <Field label="Lieu">
              <div className="space-y-2">
                <Input value={actionLocation} onChange={(e) => setActionLocation(e.target.value)} />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-[#d8c4ad] bg-[#fffdf8] text-base text-[#5b351f] hover:bg-[#f0dfcd]"
                  onClick={() => fillGpsLocation(setActionLocation)}
                >
                  📍 Utiliser ma position GPS
                </Button>
              </div>
            </Field>
            <Field label="Client Pennylane">
  <PennylaneCustomerSearchSelect
    value={actionPennylaneCustomerId}
    onChange={setActionPennylaneCustomerId}
    customers={pennylaneCustomers}
  />
</Field>
            <Field label="Commentaire action" className="md:col-span-2"><Textarea value={actionComment} onChange={(e) => setActionComment(e.target.value)} /></Field>

            {errorMessage ? (
              <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Button className="h-12 rounded-2xl bg-[#5b351f] text-base text-white hover:bg-[#3f2415]" onClick={onApplyAction}>
                <RefreshCw className="mr-2 h-4 w-4" /> Enregistrer la mise à jour
              </Button>
            </div>
          </div>
        ) : null}

        {activeTab === "historique" ? <HistoryList history={history} /> : null}
        {activeTab === "qr" ? <QrPanel machine={machine} /> : null}
        {activeTab === "etiquette" ? (
          <QrLabelEditor
            machine={machine}
            settings={labelSettings}
            setSettings={setLabelSettings}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function MachinePublicPage({ machine, client, history, clients, errorMessage, onRefreshMachine }) {
  const [status, setStatus] = useState(machine?.statut || "En stock");
  const [clientId, setClientId] = useState(machine?.clientId || "");
  const [lieu, setLieu] = useState(machine?.lieu || "");
  const [commentaire, setCommentaire] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStatus(machine?.statut || "En stock");
    setClientId(machine?.clientId || "");
    setLieu(machine?.lieu || "");
  }, [machine]);

  if (!machine) {
    return (
      <div className="min-h-screen bg-[#f4eadc] p-6">
        <Card className="mx-auto max-w-3xl rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
          <CardContent className="p-8">
            <h1 className="text-xl font-semibold text-[#2d1b12]">Machine introuvable</h1>
            <p className="mt-2 text-sm text-[#7a5f4b]">{errorMessage || "Le QR code ne correspond à aucune machine chargée."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const code = getMachineCode(machine);

  async function updateFromPublicPage() {
    try {
      setMessage("");
      const apiId = getMachineApiId(machine);

      await apiFetch(`/machines/${apiId}`, {
        method: "PATCH",
        body: JSON.stringify({
          statut: status,
          clientId: clientId || "",
          lieu,
          commentaire: commentaire || machine.commentaire || "",
          action: "Mise à jour terrain QR",
        }),
      });

      await onRefreshMachine(getMachineCode(machine));
      setCommentaire("");
      setMessage("Mise à jour enregistrée.");
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4eadc] p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-2xl text-[#2d1b12]">{code}</CardTitle>
                <p className="text-[#7a5f4b]">{machine.marque} {machine.modele}</p>
                <div className="mt-2"><Badge variant={statusVariant(machine.statut)}>{machine.statut}</Badge></div>
              </div>
              <QrMini machine={machine} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {message ? <div className="rounded-xl bg-[#f0dfcd] p-3 text-sm text-[#5b351f]">{message}</div> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Client actuel" value={client?.nom || "Sans client"} icon={UserRound} />
              <Info label="Lieu" value={machine.lieu || "-"} icon={MapPin} />
              <Info label="N° série" value={machine.numeroSerie || "-"} icon={Boxes} />
              <Info label="Date mise à disposition" value={formatDate(machine.dateMiseDisposition)} icon={CalendarDays} />
            </div>

            <Separator />

            <div>
              <h2 className="mb-4 text-lg font-semibold text-[#2d1b12]">Mise à jour terrain</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Statut"><Select value={status} onChange={setStatus}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
                <Field label="Client"><Select value={clientId} onChange={setClientId}><option value="">Sans client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select></Field>
                <Field label="Lieu"><Input value={lieu} onChange={(e) => setLieu(e.target.value)} /></Field>
                <Field label="Commentaire" className="md:col-span-2"><Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} /></Field>
                <div className="md:col-span-2">
                  <Button className="h-12 rounded-2xl bg-[#5b351f] text-base text-white hover:bg-[#3f2415]" onClick={updateFromPublicPage}>Enregistrer</Button>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="mb-4 text-lg font-semibold text-[#2d1b12]">Historique</h2>
              <HistoryList history={history} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QrPanel({ machine }) {
  const code = getMachineCode(machine);
  const url = getMachinePublicUrl(machine);

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <div className="rounded-2xl border border-[#e4d4c2] bg-white p-6 text-center">
        <QRCodeSVG value={url} size={210} />
        <div className="mt-4 font-semibold text-[#2d1b12]">{code}</div>
      </div>

      <div className="space-y-4">
        <Info label="URL publique" value={url} icon={Link2} />
      </div>
    </div>
  );
}

function QrMini({ machine }) {
  const url = getMachinePublicUrl(machine);

  return (
    <div className="rounded-2xl border border-[#e4d4c2] bg-white p-4 text-center">
      <QRCodeSVG value={url} size={120} />
    </div>
  );
}

function HistoryList({ history }) {
  if (!history.length) {
    return <p className="text-sm text-[#7a5f4b]">Aucun historique pour cette machine.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map((item, index) => (
        <div key={item.id || index} className="rounded-2xl border border-[#e4d4c2] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-[#2d1b12]">{item.action || item.type || "Mouvement"}</div>
            <div className="text-sm text-[#7a5f4b]">{formatDate(item.date || item.createdAt)}</div>
          </div>
          <div className="mt-2 text-sm text-[#7a5f4b]">
            {item.commentaire || item.comment || item.description || "-"}
          </div>
          {item.ancienStatut || item.nouveauStatut ? (
            <div className="mt-2 text-xs text-[#7a5f4b]">
              {item.ancienStatut || "-"} → {item.nouveauStatut || "-"}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <Card className="rounded-3xl border-[#e4d4c2] bg-[#fffdf8] shadow-sm">
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-[#7a5f4b]">{title}</p>
          <p className="text-3xl font-bold text-[#2d1b12]">{value}</p>
        </div>
        <div className="rounded-2xl bg-[#f0dfcd] p-3">
          <Icon className="h-5 w-5 text-[#5b351f]" />
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-[#e4d4c2] bg-[#fffdf8] p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7a5f4b]">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="break-words text-sm font-semibold text-[#2d1b12]">{value}</div>
    </div>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-2xl border border-[#d8c4ad] bg-[#fffdf8] px-4 py-2 text-sm text-[#2d1b12] shadow-sm outline-none focus:border-[#5b351f]"
    >
      {children}
    </select>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-[#5b351f]">{label}</label>
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      className={
        active
          ? "rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"
          : "rounded-2xl border-[#d8c4ad] bg-[#fffdf8] text-[#5b351f] hover:bg-[#f0dfcd]"
      }
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function LoginPage({ username, password, error, setUsername, setPassword, onLogin }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4eadc] p-6 text-[#2d1b12]">
      <Card className="w-full max-w-md rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
        <CardHeader>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5b351f] text-2xl text-white">
              ⚙️
            </div>
            <div>
              <CardTitle className="text-2xl text-[#2d1b12]">LPB Machines</CardTitle>
              <p className="text-sm text-[#7a5f4b]">Connexion administrateur</p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={onLogin}>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Field label="Identifiant">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </Field>

            <Field label="Mot de passe">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>

            <Button className="w-full rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]" type="submit">
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


function getMachineLabelTitle(machine) {
  return `${machine?.marque || ""} ${machine?.modele || ""}`.trim() || "Machine";
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);

  if (Number.isNaN(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

async function downloadMachineLabelPNG(machine, settings) {
  const widthMm = clampNumber(settings.width, 85, 50, 150);
  const heightMm = clampNumber(settings.height, 32, 25, 100);
  const scale = 12;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = Math.round(widthMm * scale);
  const height = Math.round(heightMm * scale);

  const padding = Math.round(2 * scale);
  const qrSize = Math.round(20 * scale);
  const gap = Math.round(3 * scale);

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (settings.showBorder) {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(2, Math.round(0.3 * scale));
    drawRoundedRect(
      ctx,
      Math.round(1.5 * scale),
      Math.round(1.5 * scale),
      width - Math.round(3 * scale),
      height - Math.round(3 * scale),
      Math.round(settings.borderRadius * scale)
    );
    ctx.stroke();
  }

  const qrDataUrl = await QRCodeLib.toDataURL(getMachinePublicUrl(machine), {
    width: qrSize,
    margin: 1,
  });

  const qrImage = await loadImage(qrDataUrl);

  const leftX = padding + Math.round(2 * scale);
  const qrY = padding + Math.round(2 * scale);

  if (settings.showQr) {
    ctx.drawImage(qrImage, leftX, qrY, qrSize, qrSize);
  }

  if (settings.showMachineCode) {
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(2.7 * scale)}px Arial`;
    ctx.fillText(
      getMachineCode(machine),
      leftX + qrSize / 2,
      qrY + qrSize + Math.round(3.2 * scale)
    );
  }

  const rightX = leftX + qrSize + gap;
  const rightW = width - rightX - padding - Math.round(2 * scale);
  let y = padding + Math.round(6 * scale);

  ctx.textAlign = "left";
  ctx.fillStyle = "#000000";

  if (settings.showModel) {
    ctx.font = `bold ${Math.round(3.6 * scale)}px Arial`;
    ctx.fillText(getMachineLabelTitle(machine).toUpperCase(), rightX, y, rightW);
    y += Math.round(5 * scale);
  }

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, Math.round(0.2 * scale));
  ctx.beginPath();
  ctx.moveTo(rightX, y);
  ctx.lineTo(rightX + rightW, y);
  ctx.stroke();

  y += Math.round(3.5 * scale);

  if (settings.showCompany) {
    ctx.font = `bold ${Math.round(2.2 * scale)}px Arial`;
    ctx.fillText(settings.company1 || "", rightX, y, rightW);
    y += Math.round(3 * scale);

    ctx.font = `${Math.round(1.9 * scale)}px Arial`;
    ctx.fillText(settings.company2 || "", rightX, y, rightW);
    y += Math.round(2.6 * scale);
    ctx.fillText(settings.company3 || "", rightX, y, rightW);
    y += Math.round(2.6 * scale);
    ctx.fillText(settings.company4 || "", rightX, y, rightW);
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `Etiquette-${getMachineCode(machine)}.png`;
  link.click();
}

async function printMachineLabel(machine, settings) {
  const qrDataUrl = await QRCodeLib.toDataURL(getMachinePublicUrl(machine), {
    width: 400,
    margin: 1,
  });

  const width = clampNumber(settings.width, 100, 50, 150);
  const height = clampNumber(settings.height, 70, 30, 100);
  const radius = clampNumber(settings.borderRadius, 6, 0, 20);
  const code = getMachineCode(machine);
  const model = getMachineLabelTitle(machine).toUpperCase();

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Étiquette ${code}</title>
        <style>
          @page {
            size: ${width}mm ${height}mm;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: Arial, sans-serif;
          }

          .label {
            width: ${width}mm;
            height: ${height}mm;
            padding: 2mm;
            display: flex;
            align-items: center;
            gap: 3mm;
            border: ${settings.showBorder ? "0.35mm solid #000" : "none"};
            border-radius: ${radius}mm;
            overflow: hidden;
          }

          .left {
            width: 22mm;
            text-align: center;
            flex: 0 0 22mm;
          }

          .qr {
            width: 20mm;
            height: 20mm;
            display: ${settings.showQr ? "block" : "none"};
          }

          .code {
            margin-top: 1mm;
            font-size: 3mm;
            font-weight: 800;
            display: ${settings.showMachineCode ? "block" : "none"};
          }

          .right {
            flex: 1;
            min-width: 0;
          }

          .model {
            font-size: 4mm;
            font-weight: 900;
            line-height: 1.1;
            margin-bottom: 2mm;
            display: ${settings.showModel ? "block" : "none"};
          }

          .rule {
            border-top: 0.25mm solid #000;
            margin-bottom: 2mm;
          }

          .company {
            display: ${settings.showCompany ? "block" : "none"};
          }

          .company-name {
            font-size: 2.6mm;
            font-weight: 900;
            margin-bottom: 1mm;
          }

          .company-line {
            font-size: 2.2mm;
            line-height: 1.15;
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="left">
            <img class="qr" src="${qrDataUrl}" />
            <div class="code">${code}</div>
          </div>

          <div class="right">
            <div class="model">${model}</div>
            <div class="rule"></div>

            <div class="company">
              <div class="company-name">${settings.company1 || ""}</div>
              <div class="company-line">${settings.company2 || ""}</div>
              <div class="company-line">${settings.company3 || ""}</div>
              <div class="company-line">${settings.company4 || ""}</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

function QrLabelEditor({ machine, settings, setSettings }) {
  const code = getMachineCode(machine);
  const url = getMachinePublicUrl(machine);
  const model = getMachineLabelTitle(machine).toUpperCase();

  function updateSetting(key, value) {
    setSettings({
      ...settings,
      [key]: value,
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffdf8] shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-[#2d1b12]">Paramètres étiquette QR</CardTitle>
          <p className="text-sm text-[#7a5f4b]">
            Dimensions conseillées : 100 mm × 70 mm. Les réglages sont sauvegardés sur cet ordinateur.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Largeur (mm)">
              <Input
                type="number"
                value={settings.width}
                onChange={(e) => updateSetting("width", clampNumber(e.target.value, 100, 50, 150))}
              />
            </Field>

            <Field label="Hauteur (mm)">
              <Input
                type="number"
                value={settings.height}
                onChange={(e) => updateSetting("height", clampNumber(e.target.value, 70, 30, 100))}
              />
            </Field>

            <Field label="Coins arrondis (mm)">
              <Input
                type="number"
                value={settings.borderRadius}
                onChange={(e) => updateSetting("borderRadius", clampNumber(e.target.value, 6, 0, 20))}
              />
            </Field>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <CheckboxField
              label="Afficher QR Code"
              checked={settings.showQr}
              onChange={(checked) => updateSetting("showQr", checked)}
            />
            <CheckboxField
              label="Afficher numéro machine"
              checked={settings.showMachineCode}
              onChange={(checked) => updateSetting("showMachineCode", checked)}
            />
            <CheckboxField
              label="Afficher modèle"
              checked={settings.showModel}
              onChange={(checked) => updateSetting("showModel", checked)}
            />
            <CheckboxField
              label="Afficher bordure"
              checked={settings.showBorder}
              onChange={(checked) => updateSetting("showBorder", checked)}
            />
          </div>

          <Separator />

          <Field label="Société">
            <Input value={settings.company1} onChange={(e) => updateSetting("company1", e.target.value)} />
          </Field>

          <Field label="Adresse">
            <Input value={settings.company2} onChange={(e) => updateSetting("company2", e.target.value)} />
          </Field>

          <Field label="Code postal + Ville">
            <Input value={settings.company3} onChange={(e) => updateSetting("company3", e.target.value)} />
          </Field>

          <Field label="Téléphone">
            <Input value={settings.company4} onChange={(e) => updateSetting("company4", e.target.value)} />
          </Field>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"
              onClick={() => printMachineLabel(machine, settings)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer l’étiquette
            </Button>

            <Button
              variant="outline"
              className="rounded-2xl border-[#d8c4ad] bg-[#fffdf8] text-[#5b351f] hover:bg-[#f0dfcd]"
              onClick={() => downloadMachineLabelPNG(machine, settings)}
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger PNG
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffdf8] shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-[#2d1b12]">Aperçu</CardTitle>
          <p className="text-sm text-[#7a5f4b]">
            Étiquette machine {code} · URL QR : {url}
          </p>
        </CardHeader>

        <CardContent>
          <div className="overflow-auto rounded-3xl border border-[#eadcc9] bg-white p-6">
            <div
              className="mx-auto bg-white"
              style={{
                width: `${settings.width}mm`,
                height: `${settings.height}mm`,
                padding: "7mm",
                border: settings.showBorder ? "0.35mm solid #000" : "none",
                borderRadius: `${settings.borderRadius}mm`,
              }}
            >
              <div className="flex h-full items-center gap-[3mm]">
                <div className="w-[22mm] shrink-0 text-center">
                  {settings.showQr ? <QRCodeSVG value={url} size={80} /> : null}

                  {settings.showMachineCode ? (
                    <div className="mt-[1mm] text-[3mm] font-extrabold leading-none text-black">
                      {code}
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 text-black">
                  {settings.showModel ? (
                    <div className="mb-[2mm] text-[4mm] font-black leading-tight">
                      {model}
                    </div>
                  ) : null}

                  <div className="mb-[6mm] border-t border-black" />

                  {settings.showCompany ? (
                    <div>
                      <div className="mb-[1mm] text-[2.6mm] font-black leading-tight">
                        {settings.company1}
                      </div>
                      <div className="text-[2.2mm] leading-tight">{settings.company2}</div>
                      <div className="text-[2.2mm] leading-tight">{settings.company3}</div>
                      <div className="text-[2.2mm] leading-tight">{settings.company4}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 rounded-2xl bg-[#f0dfcd] p-3 text-sm text-[#5b351f]">
            Pour l’impression : choisis une taille réelle à 100 %, sans mise à l’échelle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[#e4d4c2] bg-white px-4 py-3 text-sm font-medium text-[#5b351f]">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}


function PennylaneCustomerSearchSelect({ value, onChange, customers }) {
  const selectedCustomer = customers.find((customer) => String(customer.id) === String(value)) || null;
  const [query, setQuery] = useState(selectedCustomer?.name || selectedCustomer?.label || "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const customer = customers.find((item) => String(item.id) === String(value));
    setQuery(customer?.name || customer?.label || "");
  }, [value, customers]);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return customers
      .filter((customer) => {
        const label = [customer.name, customer.label, customer.email, customer.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return !q || label.includes(q);
      })
      .slice(0, 12);
  }, [customers, query]);

  function selectCustomer(customer) {
    onChange(String(customer.id));
    setQuery(customer.name || customer.label || customer.id);
    setIsOpen(false);
  }

  function clearCustomer() {
    onChange("");
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Tape le nom du client..."
      />

      {value ? (
        <button
          type="button"
          onClick={clearCustomer}
          className="mt-2 text-xs font-semibold text-[#5b351f] underline"
        >
          Retirer le client
        </button>
      ) : null}

      {isOpen ? (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-[#d8c4ad] bg-white shadow-lg">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onMouseDown={() => selectCustomer(customer)}
                className="block w-full border-b border-[#f0dfcd] px-4 py-3 text-left hover:bg-[#f7eddf]"
              >
                <div className="text-sm font-bold text-[#2d1b12]">
                  {customer.name || customer.label || customer.id}
                </div>
                {customer.email ? (
                  <div className="text-xs text-[#7a5f4b]">{customer.email}</div>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-[#7a5f4b]">Aucun client trouvé.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SideNav({ icon, label, active = false }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-3xl px-5 py-4 text-left text-sm font-semibold transition ${
        active ? "bg-[#5b351f] text-white shadow-sm" : "text-[#5b351f] hover:bg-[#fffaf3]"
      }`}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}