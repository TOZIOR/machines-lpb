import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import WorkspaceNav from "./WorkspaceNav";

const SECTION_LABELS = {
  cockpit: ["Cockpit SAV", "Vue opérationnelle du parc, des urgences et de la maintenance."],
  parc: ["Parc machines", "Inventaire, affectations, statuts et historique technique."],
  tickets: ["Tickets SAV", "Demandes, urgences, diagnostics et suivi de résolution."],
  preventif: ["Maintenance préventive", "Plans, échéances, check-lists et opérations programmées."],
  planning: ["Planning SAV", "Interventions, capacité et affectations des techniciens."],
  techniciens: ["Techniciens", "Compétences, disponibilités et zones d’intervention."],
  tournees: ["Tournées", "Routes, étapes et coûts de déplacement."],
  documents: ["Documents", "Rapports, notices, factures et pièces techniques."],
  reglages: ["Réglages", "Paramètres techniques et configuration de LPB Machines."],
};

export default function WorkspaceHeader({ activeSection, onChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [title, subtitle] = SECTION_LABELS[activeSection] || SECTION_LABELS.cockpit;

  useEffect(() => {
    setMobileOpen(false);
  }, [activeSection]);

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          main { padding-left: 280px; }
        }
      `}</style>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col bg-[#4a2b1a] px-4 py-5 text-white shadow-xl lg:flex">
        <div className="mb-6 px-2">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#d9b993]">LPB Torréfaction</div>
          <div className="mt-1 text-2xl font-black tracking-tight">LPB Machines</div>
          <div className="mt-1 text-xs text-[#eadcc9]">Parc technique & service après-vente</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <WorkspaceNav activeSection={activeSection} onChange={onChange} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-xs text-[#eadcc9]">
          <div className="font-semibold text-white">Architecture LPB</div>
          Machines reste la source de vérité technique du parc et du SAV.
        </div>
      </aside>

      <section className="border-b border-[#d8c4ad] bg-[#fffaf3] px-5 py-5 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a6b46]">Pilotage technique</p>
            <h2 className="mt-1 text-2xl font-extrabold text-[#2d1b12]">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#7a5f4b]">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d8c4ad] bg-white text-[#5b351f] shadow-sm lg:hidden"
            aria-label="Ouvrir le menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="mt-4 rounded-3xl bg-[#4a2b1a] p-3 shadow-lg lg:hidden">
            <WorkspaceNav activeSection={activeSection} onChange={onChange} />
          </div>
        ) : null}
      </section>
    </>
  );
}
