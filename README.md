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
| `npm run test:e2e` | Playwright: целият поток (служител на телефон, админ на десктоп) срещу production build на порт 3100; **нулира локалната база** |
| `npm run test:db` | pgTAP тестове за права и RLS (`supabase/tests/`), изисква работещ локален Supabase |
| `npm run db:reset` | пресъздава локалната база от миграциите и seed-а |
| `npm run db:types` | генерира `lib/supabase/database.types.ts` от локалната база |

Промени по схемата се правят само като нова миграция: `npx supabase migration new <име>`.

Seed-ът създава кампания `profilaktika-test` с часове за следващите 2 работни дни: http://localhost:3000/book/profilaktika-test

## Имейли

Локално, без `RESEND_API_KEY`, имейлите не се изпращат, а се записват в `.emails/` (HTML, текст и .ics) за преглед. Папката е в `.gitignore`, защото съдържа данни от записванията. `EMAIL_TRANSPORT=file` налага файловия режим и при зададен ключ (ползва се от e2e тестовете; на Vercel не е позволен).

**Тестов режим на Resend (без собствен домейн):** `EMAIL_FROM="Профилактика <onboarding@resend.dev>"`. Resend праща **само до имейла, с който е регистриран акаунтът**. Записвания с други имейли минават, но писмото не тръгва (в лога: `resend_http_403`), а в админ панела пише „не е изпратен“. Когато клиентът даде домейн, се сменя само `EMAIL_FROM` (и DNS записите по-долу).

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

## Експорт

От **Записвания** → бутоните за експорт изтеглят всички записвания по текущите филтри (не само текущата страница):

- **Excel (.xlsx)** и **CSV** (UTF-8 с BOM, разделител `;`, отваря се директно в българския Excel);
- **Експорт за JOYSTICK**: отделен профил.

Профилите са в `lib/export/profiles.ts`. За да промените формата за JOYSTICK (имена и ред на колоните, формат на дата/час/телефон, разделител, кодировка `utf-8`/`windows-1251`, xlsx/csv), редактирайте само `joystickProfile` в този файл. Всеки експорт се записва в `audit_log` (кой, кога, профил, филтри, брой редове, без самите данни).

## Деплой (Vercel + Supabase)

### 1. Supabase (production)

1. Нов проект, регион **Central EU (Frankfurt)**. Запазете паролата на базата.
2. **Project Settings → Data API**: изключете **Automatically expose new tables** (правата се дават само от миграциите).
3. Миграциите (без seed):

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

4. Ключове: **Project Settings → API Keys**. `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon (или publishable) ключ; `SUPABASE_SERVICE_ROLE_KEY` = service_role (или secret) ключ. Вторият е таен: само във Vercel, никога в браузъра или в git.
5. **Authentication**: настройките от „Настройки на Supabase Auth (production)“ по-горе. Докато няма собствен домейн, оставете вградения SMTP на Supabase: той праща само до членовете на екипа в Supabase организацията, затова админите трябва да са поканени там (**Organization → Team**). Custom SMTP през Resend се включва, когато има потвърден домейн.
6. Първият админ: „Добавяне на админ (production)“ по-горе.

### 2. Cloudflare Turnstile

Cloudflare Dashboard → **Turnstile → Add widget**: Hostname = `<проект>.vercel.app` (и собственият домейн по-късно), режим **Managed**. Site key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, Secret key → `TURNSTILE_SECRET_KEY`. Тестовите ключове не работят в production (кодът ги отказва).

### 3. Vercel

1. **Add New → Project** → импорт на GitHub репото. Framework: Next.js. Node версията идва от `package.json` (24.x), регионът на функциите от `vercel.json` (`fra1`, Франкфурт).
2. **Environment Variables** (Production):

   | Променлива | Стойност |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | от Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | от Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | от Supabase (таен) |
   | `RESEND_API_KEY` | от Resend (таен) |
   | `EMAIL_FROM` | засега `Профилактика <onboarding@resend.dev>` |
   | `EMAIL_REPLY_TO` | по желание, адрес на центъра |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | от Cloudflare |
   | `IP_HASH_SECRET` | нов случаен низ, 32+ знака (различен от локалния) |
   | `CRON_SECRET` | нов случаен низ, 32+ знака |
   | `NEXT_PUBLIC_APP_URL` | `https://<проект>.vercel.app` (без `/` в края) |
   | `DATA_RETENTION_MONTHS` | `12` |

   Случаен низ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Не** задавайте `EMAIL_TRANSPORT`.
3. Deploy. След това в Supabase: Site URL и Redirect URL = адреса от `NEXT_PUBLIC_APP_URL`.

⚠️ Vercel Hobby е само за некомерсиална употреба. За реалното пускане при клиента е нужен Pro.

### 4. Cron задачи

Описани са във `vercel.json` (часовете са в UTC) и вървят само на production deployment-а. Vercel праща `CRON_SECRET` автоматично.

| Задача | Път | График (UTC) | Какво прави |
|---|---|---|---|
| Анонимизация | `/api/cron/retention` | `0 1 * * *` | записвания с час преди повече от `DATA_RETENTION_MONTHS` месеца |
| Keep-alive | `/api/cron/keepalive` | `0 4 * * *` | заявка към базата, за да не се приспи безплатният Supabase |
| Повторно изпращане | `/api/cron/email-retry` | `0 6 * * *` | неизпратени потвърждения от последните 72 часа |
| Напомняния | `/api/cron/reminders` | `0 12 * * *` | за прегледите утре; 15:00 българско лятно време, 14:00 зимно |

На Hobby всяка задача върви най-много веднъж дневно и може да закъснее до 59 минути. **При Pro се сменя само `vercel.json`**, напр. повторното изпращане на всеки час: `"schedule": "0 * * * *"`. Ръчна проверка: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<проект>.vercel.app/api/cron/keepalive`.

## Бекъп

`.github/workflows/backup.yml` всеки ден в 00:30 UTC прави `pg_dump` (схеми `public` и `auth`), криптира го с AES-256 и го пази като artifact 90 дни.

**Настройка** (GitHub → репо → Settings → Secrets and variables → Actions → New repository secret):

- `SUPABASE_DB_URL`: Supabase → **Connect → Session pooler** (IPv4; директната връзка е само IPv6 и не работи от GitHub). Специалните знаци в паролата трябва да са URL-кодирани.
- `BACKUP_PASSPHRASE`: дълга случайна парола (20+ знака). **Пазете копие извън GitHub** (напр. в password manager): без нея бекъпите не могат да се отворят.

Първия път пуснете ръчно: Actions → Database backup → **Run workflow**, и проверете, че има artifact.

**Възстановяване** (пробвано локално; направете го поне веднъж и с истински бекъп, преди да разчитате на него):

```bash
# 1. Изтеглете artifact-а от GitHub Actions и го декриптирайте
gpg --decrypt --output db.dump profilaktika-YYYY-MM-DD.dump.gpg

# 2. Нов (празен) Supabase проект + миграциите
npx supabase link --project-ref <нов-project-ref>
npx supabase db push

# 3. Данните: първо потребителите (админите), после приложението
pg_restore --data-only --no-owner --schema=auth --table=users --table=identities -f auth.sql db.dump
pg_restore --data-only --no-owner --schema=public -f public.sql db.dump
psql "<Session pooler URL на новия проект>" --single-transaction -v ON_ERROR_STOP=1 -c "set session_replication_role = replica" -f auth.sql
psql "<Session pooler URL на новия проект>" --single-transaction -v ON_ERROR_STOP=1 -c "set session_replication_role = replica" -f public.sql
```

Нужни са `pg_restore` и `psql` версия 17 (или `docker run --rm -it postgres:17 ...`). Безплатният Supabase няма собствени бекъпи, затова при срив може да се загуби до 1 ден данни.

## Преди пускане (чеклист)

- [ ] **Vercel Pro**: комерсиална употреба.
- [ ] **Домейн** на клиента; Resend домейн с **SPF, DKIM, DMARC** → `EMAIL_FROM` с адрес от домейна; custom SMTP в Supabase Auth през Resend.
- [ ] **Turnstile** widget с истинския hostname.
- [ ] **Политика за поверителност** (`app/privacy/page.tsx`): администратор, ЕИК, адрес, контакт, правно основание, дали данните се дават на работодателя, срок на съхранение, дата; махнете банера „Чернова“. Текстът да е прегледан от юрист / длъжностното лице по защита на данните.
- [ ] **Договори за обработване на данни** (DPA) с Supabase, Vercel, Resend и Cloudflare.
- [ ] **`DATA_RETENTION_MONTHS`**, съгласуван с клиента.
- [ ] **JOYSTICK профил** (`lib/export/profiles.ts`) по примерен импорт файл; пробен импорт в JOYSTICK.
- [ ] **Админи** добавени; всеки е влязъл успешно.
- [ ] **Бекъп**: `SUPABASE_DB_URL` и `BACKUP_PASSPHRASE` в GitHub; поне един успешен run и едно пробно възстановяване.
- [ ] **Пробно записване** от телефон по истинския линк: имейл, отмяна, напомняне. Тестовите записвания в отделна тестова кампания, после я деактивирайте.
- [ ] Cron задачите се виждат във Vercel → Settings → Cron Jobs и първите им run-ове са успешни.
