const SECTIONS = [
  ["cockpit", "Cockpit"],
  ["parc", "Parc"],
  ["tickets", "Tickets SAV"],
  ["preventif", "Préventif"],
  ["planning", "Planning"],
  ["techniciens", "Techniciens"],
  ["tournees", "Tournées"],
];

export default function WorkspaceNav({ activeSection, onChange }) {
  return (
    <nav className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Navigation LPB Machines">
      {SECTIONS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-current={activeSection === key ? "page" : undefined}
          className={
            activeSection === key
              ? "rounded-full bg-[#5b351f] px-3 py-2 text-white shadow-sm"
              : "rounded-full border border-[#d8c4ad] bg-white px-3 py-2 text-[#5b351f] transition hover:bg-[#f0dfcd]"
          }
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
