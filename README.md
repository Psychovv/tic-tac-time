O jogo da velha online (e pedra, papel e tesoura, melhor de 1, 3 ou 5). Next.js 15 + Drizzle + Turso (libSQL). Convites e partidas por polling (2s; 1s durante pedra, papel e tesoura).

> `npm run db:push` aplica o schema no banco apontado por `TURSO_DATABASE_URL` do `.env` (nao necessariamente o `local.db`).

## Rodar local
1. `npm install`
2. `cp .env.example .env` (o padrao usa um SQLite local em `local.db`)
3. `npm run db:push` (cria as tabelas)
4. `npm run dev` e abra http://localhost:3000 (use duas abas/navegadores para testar)

## Producao (Vercel + Turso)
1. `turso db create tic-tac-time` e `turso db show tic-tac-time --url` / `turso db tokens create tic-tac-time`
2. Rode `npm run db:push` uma vez com `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` apontando pro Turso.
3. Na Vercel, crie as mesmas duas variaveis de ambiente e faca o deploy.
