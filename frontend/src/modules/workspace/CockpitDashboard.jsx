import { CalendarDays, MapPin, Package, ShieldCheck, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function CockpitDashboard({ stats, machines }) {
  const stoppedMachines = machines.filter((machine) => machine.statut === "Hors service").length;
  const healthScore = stats.total
    ? Math.max(0, 100 - Math.round(((stats.maintenance + stoppedMachines) / stats.total) * 100))
    : 100;

  return (
    <div className="space-y-4 px-5 pb-5 md:px-8 md:pb-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Machines suivies" value={stats.total} icon={Package} />
        <MetricCard title="Urgences SAV" value={stats.maintenance} icon={Wrench} danger />
        <MetricCard title="Chez les clients" value={stats.enClient} icon={MapPin} />
        <MetricCard title="Préventifs à planifier" value={0} icon={CalendarDays} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#d8c4ad] bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Priorités opérationnelles</h3>
            <Badge variant="outline">Aujourd'hui</Badge>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <PriorityCard title="Machines arrêtées" value={stoppedMachines} tone="red" />
            <PriorityCard title="En maintenance" value={stats.maintenance} tone="amber" />
            <PriorityCard title="Disponibles en stock" value={stats.stock} tone="emerald" />
          </div>
        </div>

        <div className="rounded-2xl border border-[#d8c4ad] bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <h3 className="font-bold">Santé du parc</h3>
          </div>
          <p className="text-3xl font-extrabold text-[#2d1b12]">{healthScore}%</p>
          <p className="mt-1 text-sm text-[#7a5f4b]">Score calculé selon les statuts actuels du parc.</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, danger = false }) {
  return (
    <Card className="rounded-2xl border-[#d8c4ad] bg-white shadow-sm">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-[#7a5f4b]">{title}</p>
          <p className={`text-2xl font-extrabold ${danger ? "text-red-700" : "text-[#2d1b12]"}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${danger ? "text-red-700" : "text-[#9a6b46]"}`} />
      </CardContent>
    </Card>
  );
}

function PriorityCard({ title, value, tone }) {
  const styles = {
    red: "bg-red-50 text-red-800",
    amber: "bg-amber-50 text-amber-800",
    emerald: "bg-emerald-50 text-emerald-800",
  };

  return (
    <div className={`rounded-xl p-3 ${styles[tone]}`}>
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
