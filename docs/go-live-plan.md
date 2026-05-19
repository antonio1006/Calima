# Calima Go-Live Plan

## Recap applicazione

L'app ora copre questi flussi:

- Home eventi: hero, manifesto, evento principale, registrazione ospite e creazione ticket su DB.
- Accesso: login reale, registrazione cliente con Supabase Auth, wallet cliente, profilo, privilegi staff.
- Admin eventi: lista eventi, statistiche, modifica evento, upload immagine, eliminazione.
- Protezione admin: la route `/admin` ora richiede un utente con ruolo `admin`.

## Simulazione funzionale locale

1. Aprire `/events`.
2. Compilare il form "Unisciti a Calima".
3. Verificare che venga creato un ticket demo.
4. Aprire `/accesso`.
5. Creare un account cliente da `/accesso`.
6. Verificare wallet e stato ticket.
7. Impostare il ruolo `admin` sul profilo Supabase dell'utente admin.
8. Accedere con quell'utente e aprire "Apri gestione eventi".
9. Modificare evento, caricare immagine, salvare.
10. Tornare alla home e verificare i dati aggiornati.

## Gap prima della produzione

- Collegare le variabili Vercel reali per Supabase e Resend.
- Verificare policy Supabase e ruoli admin/scanner.
- Aggiungere gestione pagamenti se l'evento resta a pagamento.
- Generare QR univoci lato server.
- Aggiungere scanner check-in reale.
- Rifinire email transazionali per conferma registrazione, ticket e reset accesso.
- Configurare dominio, DNS, HTTPS e ambiente di produzione.
- Aggiungere privacy policy, cookie policy se necessaria, e gestione consenso.

## Stack consigliato

- Database e Auth: Supabase, per Postgres, Auth, Storage e Row Level Security.
- Email transazionali: Resend, usando un sottodominio tipo `mail.calima...`.
- Hosting frontend: Vercel, per deploy Angular e dominio custom.
- Dominio/DNS: Cloudflare o registrar gia scelto dal cliente.

## Piano operativo

### Fase 1 - Backend base

- Creare progetto Supabase.
- Eseguire `supabase/schema.sql`.
- Creare bucket Storage per immagini evento.
- Creare utenti admin e scanner.
- Configurare variabili ambiente Vercel:
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PUBLIC_SITE_URL`.
- Verificare API Vercel:
  `/api/events`, `/api/tickets/register`, `/api/auth/register`, `/api/auth/login`,
  `/api/admin/events`.

### Fase 2 - Ticket e mail

- Creare funzione backend `create-ticket`.
- Creare funzione backend `send-ticket-email`.
- Collegare Resend al dominio.
- Preparare template email ticket e conferma accesso.

### Fase 3 - Scanner e sicurezza

- Creare pagina scanner.
- Generare QR con `public_code`.
- Validare check-in lato backend.
- Bloccare doppio ingresso.
- Applicare policy RLS complete.

### Fase 4 - Deploy

- Collegare repository a Vercel.
- Configurare variabili ambiente.
- Deploy preview.
- Collegare dominio custom.
- Verificare DNS, SSL, invio email e flussi live.

## Decisioni richieste

- Nome dominio finale: `calima.it`, da acquistare o sostituire se non disponibile.
- Provider dominio o accesso DNS: da scegliere dopo verifica disponibilita.
- Account Supabase: disponibile, personale.
- Account Vercel/GitHub: disponibile, personale.
- Account Resend: da creare.
- Mail desiderata: `eventi@calima.it`.
- Login: puo essere password o magic link, ma deve reggere molte registrazioni contemporanee.

## Nota dominio e email

`calima.it` va verificato su Registro.it o registrar prima dell'acquisto. Se il dominio risulta gia registrato, le opzioni sono:

- contattare il proprietario e acquistarlo privatamente;
- scegliere una variante, per esempio `calimaevents.it`, `calimaclub.it`, `calimatenerife.it`;
- usare un TLD alternativo, per esempio `.com`, `.events`, `.club`.

Per `eventi@calima.it` servono due livelli:

- casella reale per ricevere email: Google Workspace, Zoho Mail, Microsoft 365 o inoltro Cloudflare;
- invio transazionale: Resend, configurato con SPF, DKIM e possibilmente DMARC.

## Concorrenza registrazioni

La creazione ticket in produzione non deve contare i posti dal frontend. Lo schema Supabase include la funzione `create_ticket_atomic`, che blocca la riga evento durante la creazione ticket e impedisce overbooking quando arrivano molte registrazioni nello stesso momento.
