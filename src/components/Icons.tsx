// Icones de traco simples (estilo Feather), sem dependencia externa.
const mk = (d: string) =>
  function Icon({ className = "" }: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" className={`icon ${className}`} fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    );
  };

export const IconGrid = mk("M9 3v18M15 3v18M3 9h18M3 15h18");
export const IconTrophy = mk("M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3");
export const IconBook = mk("M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5");
export const IconLogout = mk("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9");
export const IconChevron = mk("M6 9l6 6 6-6");
export const IconClose = mk("M18 6L6 18M6 6l12 12");
export const IconUsers = mk("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75");
export const IconSearch = mk("M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35");
export const IconBolt = mk("M13 2L3 14h9l-1 8 10-12h-9l1-8z");
export const IconAlert = mk("M12 8v4M12 16h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z");
export const IconSettings = mk("M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2");
