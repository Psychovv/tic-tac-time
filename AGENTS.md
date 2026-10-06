# AGENTS.md — contexto do projeto

Site de descontracao pro setor: jogo da velha online. Um usuario "procura partida", aparece no hub dos
outros, qualquer um aceita. Ha ranking e pontos (vitoria +3, empate +1, derrota 0).

## Stack e decisoes
- Next.js 15 (App Router) + TypeScript, deploy na Vercel (Hobby, serverless: **sem WebSocket**).
- Banco: Turso (libSQL) via Drizzle. Local usa `file:local.db`. Schema em `src/db/schema.ts`, aplicado com `npm run db:push`.
- Tempo real = **polling de 2s** em `src/app/page.tsx` (hub + partida). Evitar polls pesados: o Turso free tem cota de linhas lidas.
- Login so por apelido, cookie httpOnly `uid` (`src/lib/auth.ts`). Sem senha de proposito (e um jogo interno).
- Toda regra do jogo e validada **no servidor**: `src/app/api/matches/[id]/route.ts` (aceitar atomico via UPDATE condicional,
  jogada com trava otimista pelo tabuleiro, pontuacao). Logica de vitoria em `src/lib/game.ts`.
- Tabuleiro: string de 9 chars (`.` vazio, `X` = host, `O` = convidado).

## Estado atual
Codigo escrito mas **nunca executado/testado**. Primeiro passo: `npm install`, `npm run db:push`, `npm run dev`,
corrigir o que quebrar e testar com duas abas (convite, aceitar, jogadas, vitoria, empate, ranking).

## Pendencias (ordem sugerida)
1. Abandono: partida `playing` sem jogada ha X min vira derrota por W.O. (hoje trava os dois jogadores). Convites `waiting` velhos podem ser limpos.
2. `score()` nao e atomico com o update da partida; usar `db.batch` ou transacao.
3. Impedir apelido de outra pessoa (hoje quem digita o apelido assume a conta): senha simples, PIN ou login corporativo.
4. Ranking completo (pagina propria), historico de partidas, rematch.
5. Polish de UI e acessibilidade; testes da logica em `src/lib/game.ts`.
