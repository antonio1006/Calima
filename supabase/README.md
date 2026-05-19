# Calima Supabase Plan

Questo schema prepara la versione produzione dell'app.

## Tabelle

- `profiles`: utenti, ruolo e dati personali.
- `events`: serate pubblicate o in bozza.
- `orders`: ordine creato prima del pagamento Stripe.
- `tickets`: biglietti generati solo dopo pagamento confermato.
- `checkins`: tentativi di scansione QR, accettati o negati.
- `audit_logs`: registro azioni admin/backend.

## Regola importante

Il QR non deve contenere un ID prevedibile.

Flusso corretto:

1. Backend genera `raw_token` casuale sicuro.
2. Nel database salva solo `sha256(raw_token)` in `tickets.qr_token_hash`.
3. Nel QR mette un URL tipo:

```text
https://calima.app/check-in?t=<raw_token>
```

4. Lo scanner manda il token al backend.
5. Il backend calcola l'hash e cerca il ticket.
6. Se il ticket e valido e non usato, crea un check-in `accepted`.
7. Se e gia usato, non pagato o cancellato, crea un check-in `denied`.

## Stripe

La tabella `orders` nasce `pending`.

Solo il webhook Stripe deve:

- segnare `orders.status = paid`;
- creare o validare il record `tickets`;
- inviare la mail ticket.

Mai fidarsi del redirect di successo del browser per emettere il biglietto.

## Email

Provider consigliato: Resend.

Email minime:

- conferma pagamento + QR;
- reminder evento;
- eventuale annullamento/rimborso.

## RLS

Le policy incluse sono una base:

- cliente legge solo i propri dati/ticket;
- scanner legge ticket e crea check-in;
- admin gestisce eventi e legge audit log;
- scritture critiche da backend con service role.

Prima del deploy reale vanno testate con utenti demo reali.
