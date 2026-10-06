import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Background from "@/components/Background";

const font = Outfit({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Tic Tac Time",
  description: "O jogo da velha online do setor: desafie a galera e suba no ranking.",
};
export const viewport: Viewport = { themeColor: "#0a0e1a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={font.variable}>
      <body>
        {/* Gradientes compartilhados pelas marcas X/O (stroke: url(#gx) / url(#go)). */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <linearGradient id="gx" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffb547" /><stop offset="1" stopColor="#ff6b6b" />
            </linearGradient>
            <linearGradient id="go" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#818cf8" />
            </linearGradient>
          </defs>
        </svg>
        <Background />
        {children}
      </body>
    </html>
  );
}
