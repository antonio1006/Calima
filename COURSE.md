# Corso pratico Angular - Eventi Pass

## Lezione 1: struttura base

In questa prima versione abbiamo ricostruito solo il cuore dell'app:

- routing tra `Eventi` e `Admin`;
- componenti standalone;
- form reattivi;
- service condiviso con signals;
- salvataggio temporaneo in `localStorage`;
- lista eventi e creazione ticket demo;
- gestione eventi base nell'admin.

## File da studiare in ordine

1. `src/app/app.routes.ts`
   - definisce le pagine dell'app.

2. `src/app/app.html`
   - contiene layout principale e `<router-outlet />`.

3. `src/app/models/event.model.ts`
   - definisce i tipi TypeScript: eventi, ticket, statistiche.

4. `src/app/services/event-store.ts`
   - contiene stato, signals, metodi di creazione/modifica e persistenza.

5. `src/app/pages/events-page/events-page.ts`
   - mostra dependency injection, computed signals e Reactive Forms.

6. `src/app/pages/admin-page/admin-page.ts`
   - mostra selezione evento, form di modifica e azioni admin.

## Comandi

Usa Node LTS. In questa macchina il comando verificato e:

```bash
/Users/antoniopiosiciliano/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/@angular/cli/bin/ng serve --host 127.0.0.1 --port 4300
```

App locale:

```text
http://127.0.0.1:4300
```

## Prossima lezione

Separiamo la UI in componenti più piccoli:

- `EventCardComponent`
- `RegistrationFormComponent`
- `AdminEventListComponent`
- `AdminEventFormComponent`

Questo serve a capire bene `@Input`, `@Output`, component composition e responsabilita dei componenti.

## Lezione 2: accesso per ruolo

Abbiamo sostituito il link `Admin` nella navigazione con `Accesso`.

Nuovi concetti Angular introdotti:

- `AccessPage` come pagina di login e area personale;
- `AuthStore` come service dedicato all'utente corrente;
- ruoli demo: `client`, `scanner`, `admin`;
- rendering condizionale con `@if` in base al ruolo;
- lista biglietti filtrata per email cliente;
- privilegi staff separati dai dati cliente.

Account demo:

- Cliente: `cliente@eventipass.local` / `cliente123`
- Scanner: `scanner@eventipass.local` / `scan123`
- Admin: `admin@eventipass.local` / `admin123`

## Lezione 3: brand home

Abbiamo trasformato la rotta principale in una vetrina per `Calima`.

Concetti introdotti:

- cambio identita visiva nel layout principale;
- uso di asset statici in `public/`;
- hero full-screen con immagine e logo;
- home focalizzata su un solo evento;
- seed data coerente con il brand;
- CTA che porta alla registrazione ticket.

File principali:

- `public/calima-logo.svg`
- `src/app/app.html`
- `src/app/app.css`
- `src/app/pages/events-page/events-page.html`
- `src/app/pages/events-page/events-page.css`
- `src/app/services/event-store.ts`

## Lezione 4: schema produzione

Abbiamo aggiunto una prima base Supabase/Postgres:

- `supabase/schema.sql`
- `supabase/README.md`

Concetti introdotti:

- separare `orders` e `tickets`;
- generare il biglietto solo dopo webhook Stripe;
- QR con token casuale e hash salvato nel database;
- RLS per cliente, scanner e admin;
- audit log per azioni sensibili;
- check-in accettati o negati con tracciamento.

Questo non collega ancora Angular a Supabase: e il progetto dati da cui partire quando passiamo al backend reale.
