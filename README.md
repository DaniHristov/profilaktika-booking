# Записване за профилактични прегледи

Спецификация и взети решения: [CLAUDE.md](CLAUDE.md). Изисквания на клиента: [docs/client-requirements.md](docs/client-requirements.md).

## Локален старт

Изисквания: Node 24 LTS (`.nvmrc`), Docker Desktop.

```bash
npm install
npm run db:start      # локален Supabase в Docker, прилага миграциите и seed-а
cp .env.example .env.local
# попълнете NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY и
# SUPABASE_SERVICE_ROLE_KEY от `npx supabase status`
npm run dev
```

## Скриптове

| Скрипт | Какво прави |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Vitest unit тестове (`tests/`) |
| `npm run test:db` | pgTAP тестове за права и RLS (`supabase/tests/`), изисква работещ локален Supabase |
| `npm run db:reset` | пресъздава локалната база от миграциите и seed-а |
| `npm run db:types` | генерира `lib/supabase/database.types.ts` от локалната база |

Промени по схемата се правят само като нова миграция: `npx supabase migration new <име>`.

Seed-ът създава кампания `profilaktika-test` с часове за следващите 2 работни дни.
