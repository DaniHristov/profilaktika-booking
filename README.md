# Записване за профилактични прегледи

Спецификация и взети решения: [CLAUDE.md](CLAUDE.md). Изисквания на клиента: [docs/client-requirements.md](docs/client-requirements.md).

## Локален старт

Изисквания: Node 24 LTS (`.nvmrc`), Docker Desktop.

```bash
npm install
npm run db:start      # локален Supabase в Docker, прилага миграциите и seed-а
cp .env.example .env.local
# попълнете NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY и
# SUPABASE_SERVICE_ROLE_KEY от `npx supabase status`;
# Turnstile: тестовите ключове от .env.example; IP_HASH_SECRET: случаен низ (32+ знака)
npm run dev
```

## Скриптове

| Скрипт | Какво прави |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Vitest unit тестове (`tests/`) |
| `npm run test:integration` | тестове срещу локалния Supabase, вкл. 20 паралелни записвания за един час |
| `npm run test:db` | pgTAP тестове за права и RLS (`supabase/tests/`), изисква работещ локален Supabase |
| `npm run db:reset` | пресъздава локалната база от миграциите и seed-а |
| `npm run db:types` | генерира `lib/supabase/database.types.ts` от локалната база |

Промени по схемата се правят само като нова миграция: `npx supabase migration new <име>`.

Seed-ът създава кампания `profilaktika-test` с часове за следващите 2 работни дни: http://localhost:3000/book/profilaktika-test

## Имейли

Локално, без `RESEND_API_KEY`, имейлите не се изпращат, а се записват в `.emails/` (HTML, текст и .ics) за преглед. Папката е в `.gitignore`, защото съдържа данни от записванията.

### Настройка на домейн за изпращане (преди production)

1. В Resend: **Domains → Add domain**. Ползвайте поддомейн за изпращане (напр. `mail.vashiyat-domain.bg`), за да не засягате основната поща. Ако Resend предлага избор на регион, изберете EU.
2. В DNS на домейна добавете записите, които Resend показва:
   - **SPF**: TXT запис, който разрешава на Resend (Amazon SES) да праща от името на домейна;
   - **DKIM**: TXT запис(и) с публичния ключ за подписване на имейлите;
   - **DMARC**: TXT запис на `_dmarc.<домейн>`. Започнете с `v=DMARC1; p=none; rua=mailto:<адрес за отчети>`, а след като имейлите минават проверките, затегнете до `p=quarantine` или `p=reject`.
3. Изчакайте Resend да покаже домейна като **Verified**.
4. Във Vercel задайте `RESEND_API_KEY`, `EMAIL_FROM` (с адрес от потвърдения домейн) и по желание `EMAIL_REPLY_TO`.

Без потвърден домейн имейлите или няма да тръгнат, или ще попадат в спам.

## Админ панел

Вход: `/admin` → имейл → линк за вход (magic link). Публична регистрация няма.

**Локално** seed-ът създава админ `admin@example.invalid` и потребител без права `notadmin@example.invalid`. Имейлите за вход се виждат в Mailpit: http://127.0.0.1:54324

### Добавяне на админ (production)

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**: въведете имейла, оставете **Auto Confirm User** включено. Парола не е нужна.
2. Supabase Dashboard → **SQL Editor**:

   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'ime@example.bg';
   ```

3. Човекът влиза през `/admin` с този имейл.

Премахване на админ: `delete from public.admins where email = 'ime@example.bg';`. Действа веднага, защото всяка заявка проверява таблицата.

### Настройки на Supabase Auth (production)

- **Authentication → Sign In / Providers**: изключете **Allow new users to sign up**; Email provider остава включен.
- **Authentication → URL Configuration**: Site URL = `NEXT_PUBLIC_APP_URL`; в Redirect URLs добавете `<NEXT_PUBLIC_APP_URL>/auth/confirm`.
- **Authentication → Email Templates → Magic Link**: тема „Вход в админ панела за профилактични прегледи“, съдържание от `supabase/templates/magic-link.html`.
- **Authentication → SMTP Settings**: включете custom SMTP през Resend (host `smtp.resend.com`, port 465, user `resend`, парола = Resend API ключ, подател от потвърдения домейн). Вграденият SMTP на Supabase праща само до членове на екипа и няколко имейла на час.
