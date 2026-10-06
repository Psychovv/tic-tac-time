"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { IconBook, IconChevron, IconClose, IconGrid, IconLogout, IconTrophy } from "./Icons";
import { Logo, vars } from "./Marks";

export type Tab = "jogar" | "ranking" | "regras";
const TABS = [
  { id: "jogar", label: "Jogar", Icon: IconGrid },
  { id: "ranking", label: "Ranking", Icon: IconTrophy },
  { id: "regras", label: "Regras", Icon: IconBook },
] as const;

type Props = {
  tab: Tab;
  onTab: (t: Tab) => void;
  me: { nickname: string; points: number };
  live: boolean; // ha partida em andamento/aguardando
  onLogout: () => void;
};

export default function Header({ tab, onTab, me, live, onLogout }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

  // "Pilula" deslizante que segue a aba ativa (remede quando a fonte carrega ou a tela muda).
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const place = () => {
      const el = nav.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [tab]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!userRef.current?.contains(e.target as Node)) setUserOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setUserOpen(false); setDrawer(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  const go = (t: Tab) => { onTab(t); setDrawer(false); setUserOpen(false); };
  const pts = <span className="user-pts"><b key={me.points} className="bump">{me.points}</b> pts</span>;

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <button className="brand" onClick={() => go("jogar")} aria-label="Tic Tac Time, ir para o inicio">
            <Logo />
            <span>Tic Tac <span className="grad">Time</span></span>
          </button>

          <nav className="nav" ref={navRef} aria-label="Menu principal">
            {pill && <span className="nav-pill" style={pill} />}
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} data-tab={id} className={`nav-btn${tab === id ? " active" : ""}`}
                aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>
                <Icon />{label}
                {id === "jogar" && live && <span className="live-dot" title="Partida em andamento" />}
              </button>
            ))}
          </nav>

          <div className={`user${userOpen ? " open" : ""}`} ref={userRef}>
            <button className="user-chip" onClick={() => setUserOpen((o) => !o)} aria-haspopup="menu" aria-expanded={userOpen}>
              <Avatar name={me.nickname} />
              <span className="user-meta"><span className="user-name">{me.nickname}</span>{pts}</span>
              <IconChevron className="chev" />
            </button>
            <div className={`dropdown${userOpen ? " show" : ""}`} role="menu" inert={!userOpen}>
              <div className="dropdown-head">
                <Avatar name={me.nickname} className="lg" />
                <div><div className="user-name">{me.nickname}</div>{pts}</div>
              </div>
              <button role="menuitem" className="dropdown-item" onClick={() => go("ranking")}><IconTrophy /> Ver ranking</button>
              <button role="menuitem" className="dropdown-item" onClick={() => go("regras")}><IconBook /> Como jogar</button>
              <button role="menuitem" className="dropdown-item danger" onClick={onLogout}><IconLogout /> Sair</button>
            </div>
          </div>

          <button className={`burger${drawer ? " open" : ""}`} onClick={() => setDrawer((d) => !d)}
            aria-label={drawer ? "Fechar menu" : "Abrir menu"} aria-expanded={drawer}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Menu mobile: fica fora do <header> porque backdrop-filter quebra position:fixed dos filhos. */}
      <div className={`drawer-backdrop${drawer ? " show" : ""}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer${drawer ? " show" : ""}`} inert={!drawer} aria-label="Menu">
        <div className="drawer-head">
          <Avatar name={me.nickname} className="lg" />
          <div className="grow"><div className="user-name">{me.nickname}</div>{pts}</div>
          <button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Fechar menu"><IconClose /></button>
        </div>
        {TABS.map(({ id, label, Icon }, i) => (
          <button key={id} style={vars({ "--i": i })} className={`drawer-item${tab === id ? " active" : ""}`} onClick={() => go(id)}>
            <Icon />{label}{id === "jogar" && live && <span className="live-dot" />}
          </button>
        ))}
        <div className="drawer-spacer" />
        <button style={vars({ "--i": TABS.length })} className="drawer-item danger" onClick={onLogout}><IconLogout /> Sair</button>
      </aside>
    </>
  );
}
