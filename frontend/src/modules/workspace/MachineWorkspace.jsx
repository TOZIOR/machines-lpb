import {
  Activity,
  CalendarClock,
  ExternalLink,
  FileClock,
  History,
  MapPin,
  QrCode,
  TicketPlus,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatDate(value) {
  if (!value) return "À définir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("fr-FR");
}

function machineAge(dateAchat) {
  if (!dateAchat) return "Non renseigné";
  const start = new Date(dateAchat);
  if (Number.isNaN(start.getTime())) return "Non renseigné";

  const now = new Date();
  const months = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  );

  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const yearLabel = `${years} an${years > 1 ? "s" : ""}`;
  return remainingMonths ? `${yearLabel} ${remainingMonths} mois` : yearLabel;
}

function healthScore(machine, historyCount) {
  let score = 100;
  if (machine?.statut === "En maintenance") score -= 30;
  if (machine?.statut === "Hors service") score -= 65;
  if (!machine?.numeroSerie) score -= 6;
  if (!machine?.dateAchat) score -= 4;
  score -= Math.min(10, Math.max(0, historyCount - 5));
  return Math.max(0, score);
}

function healthLabel(score) {
  if (score >= 85) return "Très bon";
  if (score >= 65) return "À surveiller";
  if (score >= 40) return "Attention";
  return "Critique";
}

function KpiCard({ icon: Icon, label, value, detail }) {
  return (
    <Card className="rounded-3xl border-[#e4d4c2] bg-white shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-2xl bg-[#f0dfcd] p-2.5 text-[#5b351f]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a8571]">{label}</p>
          <p className="mt-1 truncate text-lg font-black text-[#2d1b12]">{value}</p>
          {detail ? <p className="mt-0.5 text-xs text-[#7a5f4b]">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MachineWorkspace({
  machine,
  code,
  clientName,
  status,
  historyCount,
  onTerrain,
  onHistory,
  onQr,
  onOpenTickets,
  children,
}) {
  if (!machine) return children;

  const score = healthScore(machine, historyCount);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-[#d8c4ad] bg-[#4a2b1a] text-white shadow-lg">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-start lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">{status}</Badge>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#d9b993]">Fiche machine</span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
              {machine.marque} {machine.modele}
            </h1>
            <p className="mt-2 text-lg font-semibold text-[#eadcc9]">{code}</p>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#f5e9dc]">
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {machine.lieu || "Lieu non renseigné"}
              </span>
              <span className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                {clientName || "Sans client"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-[440px] lg:justify-end">
            <Button type="button" variant="outline" onClick={onTerrain} className="rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Wrench className="mr-2 h-4 w-4" />Mise à jour
            </Button>
            <Button type="button" variant="outline" onClick={onOpenTickets} className="rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <TicketPlus className="mr-2 h-4 w-4" />Ticket SAV
            </Button>
            <Button type="button" variant="outline" onClick={onHistory} className="rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <History className="mr-2 h-4 w-4" />Historique
            </Button>
            <Button type="button" variant="outline" onClick={onQr} className="rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <QrCode className="mr-2 h-4 w-4" />QR Code
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Activity} label="Santé estimée" value={`${score}%`} detail={healthLabel(score)} />
        <KpiCard icon={CalendarClock} label="Âge machine" value={machineAge(machine.dateAchat)} detail={machine.dateAchat ? `Achetée le ${formatDate(machine.dateAchat)}` : "Date d'achat manquante"} />
        <KpiCard icon={FileClock} label="Historique" value={`${historyCount} événement${historyCount > 1 ? "s" : ""}`} detail="Mouvements enregistrés" />
        <KpiCard icon={Wrench} label="Prochaine échéance" value={machine.maintenanceExpectedReturnDate ? formatDate(machine.maintenanceExpectedReturnDate) : "À planifier"} detail={machine.statut === "En maintenance" ? "Retour de maintenance" : "Préventif à configurer"} />
      </section>

      {children}

      <p className="px-2 text-xs text-[#9a8571]">
        L’indice de santé est une estimation calculée à partir du statut, de l’ancienneté du dossier et de l’historique disponible.
      </p>
    </div>
  );
}
