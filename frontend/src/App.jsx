import React, { useEffect, useMemo, useState } from "react";
import {
  Package,
  UserRound,
  Wrench,
  Search,
  Plus,
  ArrowRightLeft,
  MapPin,
  CalendarDays,
  Building2,
  RefreshCw,
  Link2,
  ShieldCheck,
  PlugZap,
  Boxes,
  Wifi,
  WifiOff,
  Download,
  Printer,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { QRCodeSVG } from "qrcode.react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || "change-me";

const STATUSES = [
  "En stock",
  "En préparation",
  "En prêt",
  "En location",
  "Vendue",
  "En maintenance",
  "Hors service",
];

const ASSIGNMENT_TYPES = ["Prêt", "Location", "Vente"];

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ADMIN_API_KEY,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    throw new Error(body?.error || `API error ${response.status}`);
  }

  return response.json();
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
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 40px;
          }
          .card {
            border: 1px solid #ddd;
            border-radius: 16px;
            padding: 32px;
            display: inline-block;
          }
          img {
            width: 260px;
            height: 260px;
          }
          h1 {
            font-size: 22px;
            margin-bottom: 4px;
          }
          p {
            margin: 6px 0;
            color: #444;
          }
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
  const [showClientForm, setShowClientForm] = useState(false);

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

  const [clientForm, setClientForm] = useState({
    nom: "",
    adresse: "",
    telephone: "",
    email: "",
    commentaire: "",
  });

  const [actionStatus, setActionStatus] = useState("En stock");
  const [actionClientId, setActionClientId] = useState("");
  const [actionLocation, setActionLocation] = useState("");
  const [actionType, setActionType] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [actionPennylaneCustomerId, setActionPennylaneCustomerId] = useState("");

  const [machineFormPennylaneProductId, setMachineFormPennylaneProductId] = useState("");
  const [machineFormPennylanePurchaseInvoiceId, setMachineFormPennylanePurchaseInvoiceId] = useState("");
  const [machineFormPennylaneSalesInvoiceId, setMachineFormPennylaneSalesInvoiceId] = useState("");

  async function loadAllData() {
    try {
      setErrorMessage("");

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

      const idToSelect = routeInfo.isMachineRoute
        ? routeInfo.machineCode
        : getMachineApiId(machinesData[0]) || "";

      if (idToSelect) {
        setSelectedMachineId(idToSelect);
        try {
          setMovements(await apiFetch(`/machines/${idToSelect}/movements`));
        } catch {
          setMovements([]);
        }
      } else {
        setMovements([]);
      }
    } catch {
      setErrorMessage("Impossible de charger les données API. Vérifie le backend et la clé API.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  const selectedMachine = useMemo(() => {
    if (routeInfo.isMachineRoute) {
      return (
        machines.find((m) => {
          const code = getMachineCode(m);
          return code === routeInfo.machineCode || m.id === routeInfo.machineCode || m.uuid === routeInfo.machineCode;
        }) || null
      );
    }

    return (
      machines.find((m) => {
        const apiId = getMachineApiId(m);
        return apiId === selectedMachineId || m.id === selectedMachineId || getMachineCode(m) === selectedMachineId;
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
    () => pennylaneCustomers.find((c) => c.id === selectedMachine?.pennylaneCustomerId) || null,
    [pennylaneCustomers, selectedMachine]
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
    const apiId = getMachineApiId(selectedMachine);

    return movements
      .filter((m) => !m.machineId || m.machineId === selectedMachine.uuid || m.machineId === selectedMachine.id || m.machineId === apiId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [movements, selectedMachine]);

  useEffect(() => {
    if (!selectedMachine) return;
    setActionStatus(selectedMachine.statut || "En stock");
    setActionClientId(selectedMachine.clientId || "");
    setActionLocation(selectedMachine.lieu || "");
    setActionType(selectedMachine.typeMiseDisposition || "");
    setActionComment("");
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
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "Tous" || machine.statut === statusFilter;
      const matchesClient =
        clientFilter === "Tous" ||
        (clientFilter === "Sans client" && !machine.clientId) ||
        machine.clientId === clientFilter;

      return matchesSearch && matchesStatus && matchesClient;
    });
  }, [machines, clients, pennylaneProducts, search, statusFilter, clientFilter]);

  const stats = useMemo(() => {
    return {
      total: machines.length,
      stock: machines.filter((m) => m.statut === "En stock").length,
      enClient: machines.filter((m) => ["En location", "En prêt", "Vendue"].includes(m.statut)).length,
      maintenance: machines.filter((m) => m.statut === "En maintenance").length,
    };
  }, [machines]);

  async function connectPennylane() {
    try {
      setPennylaneStatus(await apiFetch("/pennylane/connect", { method: "POST" }));
    } catch {
      setErrorMessage("Connexion Pennylane impossible.");
    }
  }

  async function syncPennylaneData() {
    try {
      setIsSyncing(true);
      const result = await apiFetch("/pennylane/sync/customers", { method: "POST" });
      setPennylaneStatus({ connected: true, lastSyncAt: result.lastSyncAt || "" });
      await loadAllData();
    } catch {
      setErrorMessage("Synchronisation Pennylane impossible.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function createClient() {
    try {
      setErrorMessage("");
      const newClient = await apiFetch("/clients", {
        method: "POST",
        body: JSON.stringify(clientForm),
      });

      setClients((prev) => [...prev, newClient].sort((a, b) => a.nom.localeCompare(b.nom)));
      setClientForm({ nom: "", adresse: "", telephone: "", email: "", commentaire: "" });
      setShowClientForm(false);
    } catch {
      setErrorMessage("Création client impossible.");
    }
  }

  async function createMachine() {
    try {
      setErrorMessage("");
      const createdMachine = await apiFetch("/machines", {
        method: "POST",
        body: JSON.stringify({
          ...machineForm,
          pennylaneProductId: machineFormPennylaneProductId || null,
          pennylanePurchaseInvoiceId: machineFormPennylanePurchaseInvoiceId || null,
          pennylaneSalesInvoiceId: machineFormPennylaneSalesInvoiceId || null,
        }),
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
      setMachineFormPennylaneProductId("");
      setMachineFormPennylanePurchaseInvoiceId("");
      setMachineFormPennylaneSalesInvoiceId("");
      setShowMachineForm(false);
    } catch {
      setErrorMessage("Création machine impossible.");
    }
  }

  async function applyAction() {
    if (!selectedMachine) return;

    try {
      setErrorMessage("");
      const apiId = getMachineApiId(selectedMachine);

      const updatedMachine = await apiFetch(`/machines/${apiId}`, {
        method: "PATCH",
        body: JSON.stringify({
          statut: actionStatus,
          clientId: actionClientId || "",
          lieu: actionLocation || "",
          typeMiseDisposition: actionType || "",
          commentaire: actionComment || selectedMachine.commentaire || "",
          pennylaneCustomerId: actionPennylaneCustomerId || "",
          action: "Mise à jour",
        }),
      });

      setMachines((prev) => prev.map((m) => (getMachineApiId(m) === apiId ? updatedMachine : m)));
      setMovements(await apiFetch(`/machines/${apiId}/movements`));
      setActionComment("");
    } catch {
      setErrorMessage("Mise à jour machine impossible.");
    }
  }

  async function refreshMachine(machineCode) {
    const [machinesData, clientsData] = await Promise.all([apiFetch("/machines"), apiFetch("/clients")]);
    setMachines(machinesData);
    setClients(clientsData);

    if (machineCode) {
      setSelectedMachineId(machineCode);
      setMovements(await apiFetch(`/machines/${machineCode}/movements`));
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-8 text-sm text-slate-600">
              Chargement des données depuis l’API…
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

if (routeInfo.isMachineRoute) {
  return (
    <MachinePublicPage
      machine={selectedMachine}
      client={selectedClient}
      pennylaneCustomer={selectedPennylaneCustomer}
      pennylaneProduct={selectedPennylaneProduct}
      purchaseInvoice={selectedPurchaseInvoice}
      salesInvoice={selectedSalesInvoice}
      history={machineHistory}
      clients={clients}
      onRefreshMachine={refreshMachine}
    />
  );
}

return (
  <div className="min-h-screen bg-[#f4eadc] text-[#2d1b12]">      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-[#d8c4ad] bg-[#eadcc9] p-4 lg:block">
          <div className="mb-8 flex items-center gap-3 rounded-3xl bg-[#fffaf3] p-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5b351f] text-2xl text-white">
              ⚙️
            </div>
            <div>
              <div className="text-lg font-bold text-[#2d1b12]">LPB</div>
              <div className="text-sm text-[#7a5f4b]">Parc machines</div>
            </div>
          </div>

          <nav className="space-y-3">
            <SideNav active icon="🏠" label="Accueil" />
            <SideNav icon="📦" label="Machines" />
            <SideNav icon="👤" label="Clients" />
            <SideNav icon="🔧" label="Maintenance" />
            <SideNav icon="🔗" label="Pennylane" />
            <SideNav icon="🧾" label="Historique" />
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="bg-[#5b351f] px-5 py-6 text-white md:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">LPB Machines</h1>
                <p className="mt-1 text-sm text-[#eadcc9]">
                  Gestion du parc machines · Supabase · Pennylane
                </p>
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
                      <Button
                        variant="outline"
                        className="rounded-2xl border-[#d8c4ad] bg-[#fffdf8] text-[#5b351f] hover:bg-[#f0dfcd]"
                        onClick={() => setShowClientForm((v) => !v)}
                      >
                        Nouveau client
                      </Button>
                      <Button
                        className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]"
                        onClick={() => setShowMachineForm((v) => !v)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>
                  </div>

                  {showClientForm ? (
                    <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffdf8] shadow-none">
                      <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                        <Field label="Nom">
                          <Input value={clientForm.nom} onChange={(e) => setClientForm({ ...clientForm, nom: e.target.value })} />
                        </Field>
                        <Field label="Téléphone">
                          <Input value={clientForm.telephone} onChange={(e) => setClientForm({ ...clientForm, telephone: e.target.value })} />
                        </Field>
                        <Field label="Email">
                          <Input value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
                        </Field>
                        <Field label="Adresse">
                          <Input value={clientForm.adresse} onChange={(e) => setClientForm({ ...clientForm, adresse: e.target.value })} />
                        </Field>
                        <Field label="Commentaire" className="md:col-span-2">
                          <Textarea value={clientForm.commentaire} onChange={(e) => setClientForm({ ...clientForm, commentaire: e.target.value })} />
                        </Field>
                        <div className="md:col-span-2">
                          <Button onClick={createClient} className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]">
                            Créer le client
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {showMachineForm ? (
                    <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffdf8] shadow-none">
                      <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                        <Field label="Marque">
                          <Input value={machineForm.marque} onChange={(e) => setMachineForm({ ...machineForm, marque: e.target.value })} />
                        </Field>
                        <Field label="Modèle">
                          <Input value={machineForm.modele} onChange={(e) => setMachineForm({ ...machineForm, modele: e.target.value })} />
                        </Field>
                        <Field label="N° série">
                          <Input value={machineForm.numeroSerie} onChange={(e) => setMachineForm({ ...machineForm, numeroSerie: e.target.value })} />
                        </Field>
                        <Field label="Fournisseur">
                          <Input value={machineForm.fournisseur} onChange={(e) => setMachineForm({ ...machineForm, fournisseur: e.target.value })} />
                        </Field>
                        <Field label="Date achat">
                          <Input type="date" value={machineForm.dateAchat} onChange={(e) => setMachineForm({ ...machineForm, dateAchat: e.target.value })} />
                        </Field>
                        <Field label="Prix achat">
                          <Input type="number" value={machineForm.prixAchat} onChange={(e) => setMachineForm({ ...machineForm, prixAchat: e.target.value })} />
                        </Field>
                        <Field label="Facture achat">
                          <Input value={machineForm.factureAchat} onChange={(e) => setMachineForm({ ...machineForm, factureAchat: e.target.value })} />
                        </Field>
                        <Field label="Lieu">
                          <Input value={machineForm.lieu} onChange={(e) => setMachineForm({ ...machineForm, lieu: e.target.value })} />
                        </Field>

                        <Field label="Produit Pennylane">
                          <Select value={machineFormPennylaneProductId} onChange={setMachineFormPennylaneProductId}>
                            <option value="">Aucun</option>
                            {pennylaneProducts.map((p) => (
                              <option key={p.id} value={p.id}>{p.label || p.name || p.id}</option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Facture achat Pennylane">
                          <Select value={machineFormPennylanePurchaseInvoiceId} onChange={setMachineFormPennylanePurchaseInvoiceId}>
                            <option value="">Aucune</option>
                            {pennylaneInvoices.map((invoice) => (
                              <option key={invoice.id} value={invoice.id}>{invoice.number || invoice.label || invoice.id}</option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Facture vente Pennylane">
                          <Select value={machineFormPennylaneSalesInvoiceId} onChange={setMachineFormPennylaneSalesInvoiceId}>
                            <option value="">Aucune</option>
                            {pennylaneInvoices.map((invoice) => (
                              <option key={invoice.id} value={invoice.id}>{invoice.number || invoice.label || invoice.id}</option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Commentaire" className="md:col-span-2">
                          <Textarea value={machineForm.commentaire} onChange={(e) => setMachineForm({ ...machineForm, commentaire: e.target.value })} />
                        </Field>

                        <div className="md:col-span-2">
                          <Button onClick={createMachine} className="rounded-2xl bg-[#5b351f] text-white hover:bg-[#3f2415]">
                            Créer la machine
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="grid gap-2 md:grid-cols-2">
                    <Select value={statusFilter} onChange={setStatusFilter}>
                      <option value="Tous">Tous les statuts</option>
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </Select>

                    <Select value={clientFilter} onChange={setClientFilter}>
                      <option value="Tous">Tous les clients</option>
                      <option value="Sans client">Sans client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.nom}</option>
                      ))}
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
                              const apiId = getMachineApiId(machine);
                              setSelectedMachineId(apiId);
                              setMovements(await apiFetch(`/machines/${apiId}/movements`));
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
                              <Badge variant={statusVariant(machine.statut)}>{machine.statut}</Badge>
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
                clients={clients}
                pennylaneCustomers={pennylaneCustomers}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                actionStatus={actionStatus}
                setActionStatus={setActionStatus}
                actionClientId={actionClientId}
                setActionClientId={setActionClientId}
                actionLocation={actionLocation}
                setActionLocation={setActionLocation}
                actionType={actionType}
                setActionType={setActionType}
                actionComment={actionComment}
                setActionComment={setActionComment}
                actionPennylaneCustomerId={actionPennylaneCustomerId}
                setActionPennylaneCustomerId={setActionPennylaneCustomerId}
                onApplyAction={applyAction}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MachineDetailPanel({
  machine,
  client,
  pennylaneCustomer,
  pennylaneProduct,
  purchaseInvoice,
  salesInvoice,
  history,
  clients,
  pennylaneCustomers,
  activeTab,
  setActiveTab,
  actionStatus,
  setActionStatus,
  actionClientId,
  setActionClientId,
  actionLocation,
  setActionLocation,
  actionType,
  setActionType,
  actionComment,
  setActionComment,
  actionPennylaneCustomerId,
  setActionPennylaneCustomerId,
  onApplyAction,
}) {
  if (!machine) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-8 text-sm text-slate-500">Aucune machine sélectionnée.</CardContent>
      </Card>
    );
  }

  const code = getMachineCode(machine);
  const publicUrl = getMachinePublicUrl(machine);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-2xl">{code}</CardTitle>
            <p className="text-slate-600">{machine.marque} {machine.modele}</p>
            <div className="mt-2">
              <Badge variant={statusVariant(machine.statut)}>{machine.statut}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => downloadQRCode(publicUrl, code)}>
              <Download className="mr-2 h-4 w-4" />
              Télécharger QR
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => printQRCode(machine)}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <TabButton active={activeTab === "fiche"} onClick={() => setActiveTab("fiche")}>Fiche</TabButton>
          <TabButton active={activeTab === "terrain"} onClick={() => setActiveTab("terrain")}>Mise à jour terrain</TabButton>
          <TabButton active={activeTab === "historique"} onClick={() => setActiveTab("historique")}>Historique</TabButton>
          <TabButton active={activeTab === "qr"} onClick={() => setActiveTab("qr")}>QR page</TabButton>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {activeTab === "fiche" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Info label="Client" value={client?.nom || "Sans client"} icon={UserRound} />
            <Info label="Lieu" value={machine.lieu || "-"} icon={MapPin} />
            <Info label="N° série" value={machine.numeroSerie || "-"} icon={Boxes} />
            <Info label="Date achat" value={formatDate(machine.dateAchat)} icon={CalendarDays} />
            <Info label="Fournisseur" value={machine.fournisseur || "-"} icon={Building2} />
            <Info label="Prix achat" value={formatAmount(machine.prixAchat)} icon={Package} />
            <Info label="Date mise à disposition" value={formatDate(machine.dateMiseDisposition)} icon={CalendarDays} />
            <Info label="Type mise à disposition" value={machine.typeMiseDisposition || "-"} icon={ArrowRightLeft} />
            <Info label="Client Pennylane" value={pennylaneCustomer?.name || pennylaneCustomer?.label || "-"} icon={ShieldCheck} />
            <Info label="Produit Pennylane" value={pennylaneProduct?.label || pennylaneProduct?.name || "-"} icon={Link2} />
            <Info label="Facture achat" value={purchaseInvoice?.number || machine.factureAchat || "-"} icon={Link2} />
            <Info label="Facture vente" value={salesInvoice?.number || "-"} icon={Link2} />
            <div className="md:col-span-2">
              <Info label="Commentaire" value={machine.commentaire || "-"} icon={Wrench} />
            </div>
          </div>
        ) : null}

        {activeTab === "terrain" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Statut">
              <Select value={actionStatus} onChange={setActionStatus}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </Field>

            <Field label="Client">
              <Select value={actionClientId} onChange={setActionClientId}>
                <option value="">Sans client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </Select>
            </Field>

            <Field label="Lieu">
              <Input value={actionLocation} onChange={(e) => setActionLocation(e.target.value)} />
            </Field>

            <Field label="Type mise à disposition">
              <Select value={actionType} onChange={setActionType}>
                <option value="">Aucun</option>
                {ASSIGNMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </Field>

            <Field label="Client Pennylane">
              <Select value={actionPennylaneCustomerId} onChange={setActionPennylaneCustomerId}>
                <option value="">Aucun</option>
                {pennylaneCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.label || c.id}</option>
                ))}
              </Select>
            </Field>

            <Field label="Commentaire action" className="md:col-span-2">
              <Textarea value={actionComment} onChange={(e) => setActionComment(e.target.value)} />
            </Field>

            <div className="md:col-span-2">
              <Button className="rounded-xl" onClick={onApplyAction}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Enregistrer la mise à jour
              </Button>
            </div>
          </div>
        ) : null}

        {activeTab === "historique" ? <HistoryList history={history} /> : null}

        {activeTab === "qr" ? (
          <QrPanel machine={machine} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function MachinePublicPage({ machine, client, history, clients, onRefreshMachine }) {
  const [status, setStatus] = useState(machine?.statut || "En stock");
  const [clientId, setClientId] = useState(machine?.clientId || "");
  const [lieu, setLieu] = useState(machine?.lieu || "");
  const [type, setType] = useState(machine?.typeMiseDisposition || "");
  const [commentaire, setCommentaire] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStatus(machine?.statut || "En stock");
    setClientId(machine?.clientId || "");
    setLieu(machine?.lieu || "");
    setType(machine?.typeMiseDisposition || "");
  }, [machine]);

  if (!machine) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="mx-auto max-w-3xl rounded-2xl shadow-sm">
          <CardContent className="p-8">
            <h1 className="text-xl font-semibold">Machine introuvable</h1>
            <p className="mt-2 text-sm text-slate-500">Le QR code ne correspond à aucune machine chargée.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const code = getMachineCode(machine);

  async function updateFromPublicPage() {
    try {
      const apiId = getMachineApiId(machine);

      await apiFetch(`/machines/${apiId}`, {
        method: "PATCH",
        body: JSON.stringify({
          statut: status,
          clientId: clientId || "",
          lieu,
          typeMiseDisposition: type || "",
          commentaire: commentaire || machine.commentaire || "",
          action: "Mise à jour terrain QR",
        }),
      });

      await onRefreshMachine(apiId);
      setCommentaire("");
      setMessage("Mise à jour enregistrée.");
    } catch {
      setMessage("Erreur pendant la mise à jour.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-2xl">{code}</CardTitle>
                <p className="text-slate-600">{machine.marque} {machine.modele}</p>
                <div className="mt-2">
                  <Badge variant={statusVariant(machine.statut)}>{machine.statut}</Badge>
                </div>
              </div>
              <QrMini machine={machine} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {message ? (
              <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Client actuel" value={client?.nom || "Sans client"} icon={UserRound} />
              <Info label="Lieu" value={machine.lieu || "-"} icon={MapPin} />
              <Info label="N° série" value={machine.numeroSerie || "-"} icon={Boxes} />
              <Info label="Date mise à disposition" value={formatDate(machine.dateMiseDisposition)} icon={CalendarDays} />
            </div>

            <Separator />

            <div>
              <h2 className="mb-4 text-lg font-semibold">Mise à jour terrain</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Statut">
                  <Select value={status} onChange={setStatus}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Client">
                  <Select value={clientId} onChange={setClientId}>
                    <option value="">Sans client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Lieu">
                  <Input value={lieu} onChange={(e) => setLieu(e.target.value)} />
                </Field>

                <Field label="Type mise à disposition">
                  <Select value={type} onChange={setType}>
                    <option value="">Aucun</option>
                    {ASSIGNMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Commentaire" className="md:col-span-2">
                  <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
                </Field>

                <div className="md:col-span-2">
                  <Button className="rounded-xl" onClick={updateFromPublicPage}>
                    Enregistrer
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h2 className="mb-4 text-lg font-semibold">Historique</h2>
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
      <div className="rounded-2xl border bg-white p-6 text-center">
        <QRCodeSVG value={url} size={210} />
        <div className="mt-4 font-semibold">{code}</div>
      </div>

      <div className="space-y-4">
        <Info label="URL publique" value={url} icon={Link2} />
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-xl" onClick={() => downloadQRCode(url, code)}>
            <Download className="mr-2 h-4 w-4" />
            Télécharger QR PNG
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => printQRCode(machine)}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimer QR
          </Button>
        </div>
      </div>
    </div>
  );
}

function QrMini({ machine }) {
  const url = getMachinePublicUrl(machine);
  return (
    <div className="rounded-2xl border bg-white p-4 text-center">
      <QRCodeSVG value={url} size={120} />
    </div>
  );
}

function HistoryList({ history }) {
  if (!history.length) {
    return <p className="text-sm text-slate-500">Aucun historique pour cette machine.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map((item, index) => (
        <div key={item.id || index} className="rounded-2xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-slate-900">{item.action || item.type || "Mouvement"}</div>
            <div className="text-sm text-slate-500">{formatDate(item.date || item.createdAt)}</div>
          </div>
          <div className="mt-2 text-sm text-slate-600">
            {item.commentaire || item.comment || item.description || "-"}
          </div>
          {item.statut ? (
            <div className="mt-2">
              <Badge variant={statusVariant(item.statut)}>{item.statut}</Badge>
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

function SideNav({ icon, label, active = false }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-3xl px-5 py-4 text-left text-sm font-semibold transition ${
        active
          ? "bg-[#5b351f] text-white shadow-sm"
          : "text-[#5b351f] hover:bg-[#fffaf3]"
      }`}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}