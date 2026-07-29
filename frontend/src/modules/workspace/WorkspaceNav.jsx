import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  MapPinned,
  Server,
  Settings,
  ShieldCheck,
  TicketCheck,
  UsersRound,
  Wrench,
} from "lucide-react";

const SECTIONS = [
  { key: "cockpit", label: "Cockpit", icon: LayoutDashboard },
  { key: "parc", label: "Parc machines", icon: Server },
  { key: "tickets", label: "Tickets SAV", icon: TicketCheck },
  { key: "preventif", label: "Préventif", icon: ShieldCheck },
  { key: "planning", label: "Planning", icon: CalendarDays },
  { key: "techniciens", label: "Techniciens", icon: UsersRound },
  { key: "tournees", label: "Tournées", icon: MapPinned },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "reglages", label: "Réglages", icon: Settings },
];

export default function WorkspaceNav({ activeSection, onChange }) {
  return (
    <nav className="space-y-1" aria-label="Navigation LPB Machines">
      {SECTIONS.map(({ key, label, icon: Icon }) => {
        const isActive = activeSection === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={isActive ? "page" : undefined}
            className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
              isActive
                ? "bg-white text-[#5b351f] shadow-sm"
                : "text-[#eadcc9] hover:bg-white/10 hover:text-white"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                isActive ? "bg-[#f0dfcd]" : "bg-white/10 group-hover:bg-white/15"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>{label}</span>
          </button>
        );
      })}

      <div className="my-3 border-t border-white/15" />

      <div className="rounded-2xl bg-white/10 p-3 text-xs leading-relaxed text-[#eadcc9]">
        <div className="mb-2 flex items-center gap-2 font-bold text-white">
          <Wrench className="h-4 w-4" />
          Centre technique LPB
        </div>
        Parc, SAV et maintenance réunis dans un seul espace opérationnel.
      </div>
    </nav>
  );
}
