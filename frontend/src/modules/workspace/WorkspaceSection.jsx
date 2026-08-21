import {
  CalendarDays,
  FileText,
  MapPin,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TicketsBoard from "./TicketsBoard";
import ClientsBoard from "./ClientsBoard";
import PlanningBoard from "./PlanningBoard";

const SECTIONS = {
  preventif: {
    title: "Maintenance préventive",
    subtitle: "Piloter les plans, échéances, check-lists et opérations à programmer.",
    icon: ShieldCheck,
    cards: [["À planifier", "0", "Occurrences arrivées à échéance"], ["Planifiées", "0", "Opérations déjà programmées"], ["En retard", "0", "Préventifs dépassant l’échéance"]],
    emptyTitle: "Aucun préventif à afficher",
    emptyText: "Les plans de maintenance et leurs occurrences seront alimentés par le moteur préventif du backend.",
  },
  planning: {
    title: "Planning SAV",
    subtitle: "Organiser les interventions et visualiser la capacité opérationnelle.",
    icon: CalendarDays,
    cards: [["Aujourd’hui", "0", "Interventions prévues"], ["Cette semaine", "0", "Créneaux planifiés"], ["À affecter", "0", "Interventions sans technicien"]],
    emptyTitle: "Planning disponible pour les prochaines affectations",
    emptyText: "Cet espace accueillera le calendrier des interventions, les disponibilités et les exceptions de planning.",
  },
  techniciens: {
    title: "Techniciens",
    subtitle: "Suivre les profils, compétences, disponibilités et habilitations.",
    icon: UserRound,
    cards: [["Actifs", "0", "Techniciens disponibles"], ["Indisponibles", "0", "Absences ou exceptions"], ["Alertes", "0", "Compétences ou certifications"]],
    emptyTitle: "Aucun profil technicien configuré",
    emptyText: "Les profils techniques seront reliés aux compétences, zones de service et modèles de travail.",
  },
  tournees: {
    title: "Tournées",
    subtitle: "Préparer les routes, les étapes et les coûts de déplacement.",
    icon: MapPin,
    cards: [["À préparer", "0", "Tournées sans ordre définitif"], ["En cours", "0", "Routes actuellement exécutées"], ["Terminées", "0", "Tournées clôturées aujourd’hui"]],
    emptyTitle: "Aucune tournée planifiée",
    emptyText: "Le module calculera les étapes, les distances et les coûts à partir des interventions affectées.",
  },
  documents: {
    title: "Documents techniques",
    subtitle: "Centraliser les pièces utiles au suivi des machines et des interventions.",
    icon: FileText,
    cards: [["Rapports", "0", "Comptes rendus d’intervention"], ["Notices", "0", "Documentation constructeurs"], ["Pièces jointes", "0", "Photos, factures et justificatifs"]],
    emptyTitle: "Aucun document technique enregistré",
    emptyText: "Les documents seront rattachés aux machines, tickets, interventions et contrats sans dupliquer les données CRM.",
  },
  reglages: {
    title: "Réglages",
    subtitle: "Configurer le fonctionnement technique de LPB Machines.",
    icon: Settings,
    cards: [["Statuts", "7", "Cycle de vie des machines"], ["Intégrations", "2", "CRM et Pennylane"], ["Automatisations", "0", "Règles techniques actives"]],
    emptyTitle: "Configuration centralisée",
    emptyText: "Cet espace accueillera les paramètres du SAV, du préventif, des compteurs, des déplacements et des notifications techniques.",
  },
};

export default function WorkspaceSection({
  section,
  clients = [],
  machines = [],
  ticketDraft = null,
  onCreateTicket,
  onTicketDraftConsumed,
}) {
  if (section === "tickets") {
    return (
      <TicketsBoard
        clients={clients}
        machines={machines}
        initialContext={ticketDraft}
        onInitialContextConsumed={onTicketDraftConsumed}
      />
    );
  }

  if (section === "clients") {
    return (
      <ClientsBoard
        clients={clients}
        machines={machines}
        onCreateTicket={onCreateTicket}
      />
    );
  }

  if (section === "planning") {
    return <PlanningBoard />;
  }

  const config = SECTIONS[section] || SECTIONS.preventif;
  const Icon = config.icon;

  return (
    <div className="space-y-6 p-5 md:p-8">
      <Card className="rounded-3xl border-[#d8c4ad] bg-[#fffaf3] shadow-sm">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#f0dfcd] p-3"><Icon className="h-6 w-6 text-[#5b351f]" /></div>
            <div><CardTitle className="text-2xl text-[#2d1b12]">{config.title}</CardTitle><p className="mt-1 text-sm text-[#7a5f4b]">{config.subtitle}</p></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {config.cards.map(([title, value, description]) => (
              <div key={title} className="rounded-3xl border border-[#e4d4c2] bg-white p-5 shadow-sm"><div className="text-sm font-semibold text-[#7a5f4b]">{title}</div><div className="mt-2 text-3xl font-black text-[#2d1b12]">{value}</div><div className="mt-1 text-xs text-[#9a8571]">{description}</div></div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-dashed border-[#d8c4ad] bg-white/70 shadow-none">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
          <div className="rounded-3xl bg-[#f0dfcd] p-4"><Icon className="h-8 w-8 text-[#5b351f]" /></div>
          <h3 className="mt-5 text-xl font-extrabold text-[#2d1b12]">{config.emptyTitle}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#7a5f4b]">{config.emptyText}</p>
        </CardContent>
      </Card>
    </div>
  );
}
