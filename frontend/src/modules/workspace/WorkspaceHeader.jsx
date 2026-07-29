import WorkspaceNav from "./WorkspaceNav";

export default function WorkspaceHeader({ activeSection, onChange }) {
  return (
    <section className="border-b border-[#d8c4ad] bg-[#fffaf3] px-5 py-5 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a6b46]">Pilotage technique</p>
          <h2 className="text-2xl font-extrabold text-[#2d1b12]">
            {activeSection === "cockpit" ? "Cockpit SAV" : "LPB Machines"}
          </h2>
          <p className="mt-1 text-sm text-[#7a5f4b]">
            {activeSection === "cockpit"
              ? "Vue opérationnelle du parc, des urgences et de la maintenance."
              : "Navigation technique du parc et du service après-vente."}
          </p>
        </div>
        <WorkspaceNav activeSection={activeSection} onChange={onChange} />
      </div>
    </section>
  );
}
