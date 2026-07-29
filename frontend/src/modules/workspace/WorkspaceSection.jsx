import { CalendarDays, MapPin, ShieldCheck, UserRound, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = {
  tickets: {
    title: "Tickets SAV",
    subtitle: "Centraliser les demandes, qualifier les urgences et suivre leur résolution.",
    icon: Wrench,
    cards: [
      ["Nouveaux tickets", "0", "Demandes à qualifier"],
      ["Urgents", "0", "Interventions prioritaires"],
      ["En cours", "0", "Tickets actuellement traités"],
    ],
    emptyTitle: "Aucun ticket SAV ouvert",
    emptyText: "Cet écran sera connecté aux tickets, diagnostics et interventions enregistrés dans LPB Machines.",
  },
  preventif: {
    title: "Maintenance préventive",
    subtitle: "Piloter les plans, échéances, check-lists et opérations à programmer.",
    icon: ShieldCheck,
    cards: [
      ["À planifier", "0", "Occurrences arrivées à échéance"],
      ["Planifiées", "0", "Opérations déjà programmées"],
      ["En retard", "0", "Préventifs dépassant l'échéance"],
    ],
    emptyTitle: "Aucun préventif à afficher",
    emptyText: "Les plans de maintenance et leurs occurrences seront alimentés par le moteur préventif du backend.",
  },
  planning: {
    title: "Planning SAV",
    subtitle: "Organiser les interventions et visualiser la capacité opérationnelle.",
    icon: CalendarDays,
    cards: [
      ["Aujourd'hui", "0", "Interventions prévues"],
      ["Cette semaine", "0", "Créneaux planifiés"],
      ["À affecter", "0", "Interventions sans technicien"],
    ],
    emptyTitle: "Planning disponible pour les prochaines affectations",
    emptyText: "Cet espace accueillera le calendrier des interventions, les disponibilités et les exceptions de planning.",
  },
  techniciens: {
    title: "Techniciens",
    subtitle: "Suivre les profils, compétences, disponibilités et habilitations.",
    icon: UserRound,
    cards: [
      ["Actifs", "0", "Techniciens disponibles"],
      ["Indisponibles", "0", "Absences ou exceptions"],
      ["Alertes", "0", "Compétences ou certifications"],
    ],
    emptyTitle: "Aucun profil technicien configuré",
    emptyText: "Les profils techniques seront reliés aux compétences, zones de service et modèles de travail.",
  },
  tournees: {
    title: "Tournées",
    subtitle: "Préparer les routes, les étapes et les coûts de déplacement.",
    icon: MapPin,
    cards: [
      ["À préparer", "0", "Tournées sans ordre définitif"],
      ["En cours", "0", "Routes actuellement exécutées"],
      ["Terminées", "0", "Tournées clôturées aujourd'hui"],
    ],
    emptyTitle: "Aucune tournée planifiée",
    emptyText: "Le module calculera les étapes, les distances et les coûts à partir des interventions affectées.",
  },
};

export default function WorkspaceSection({ section }) {
  const config = SECTIONS[section] || SECTIONS.tickets;
  const Icon = config.icon;

  return (
    <div className="space-y-6 p-5 md:p-8">
      <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#f0dfcd] p-3">
              <Icon className="h-6 w-6 text-[#5b351f]" />
            </div>
            <div>
              <CardTitle className="text-2xl text-[#2d1b12]">{config.title}</CardTitle>
              <p className="mt-1 text-sm text-[#7a5f4b]">{config.subtitle}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {config.cards.map(([title, value, subtitle]) => (
          <Card key={title} className="rounded-3xl border-[#e4d4c2] bg-[#fffdf8] shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm font-semibold text-[#5b351f]">{title}</p>
              <p className="mt-2 text-3xl font-extrabold text-[#2d1b12]">{value}</p>
              <p className="mt-1 text-xs text-[#7a5f4b]">{subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-dashed border-[#d8c4ad] bg-white shadow-sm">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
          <div className="rounded-3xl bg-[#f0dfcd] p-4">
            <Icon className="h-8 w-8 text-[#5b351f]" />
          </div>
          <h3 className="mt-5 text-xl font-bold text-[#2d1b12]">{config.emptyTitle}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a5f4b]">{config.emptyText}</p>
          <Badge variant="outline" className="mt-5 border-[#d8c4ad] text-[#5b351f]">Module prêt à connecter</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
