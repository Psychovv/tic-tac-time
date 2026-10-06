import { vars } from "./Marks";

// Avatar com iniciais e cor estavel derivada do apelido.
export function Avatar({ name, photo, className = "" }: { name: string; photo?: string | null; className?: string }) {
  if (photo) {
    return <img src={photo} alt={name} className={`avatar ${className}`} style={{ objectFit: 'cover' }} aria-hidden="true" />;
  }
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={`avatar ${className}`} style={vars({ "--h": h })} aria-hidden="true">
      {[...name].slice(0, 2).join("").toUpperCase()}
    </span>
  );
}
