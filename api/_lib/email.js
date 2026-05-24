async function sendTicketEmail({ ticket, event }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { skipped: true };
  }

  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://calima.it';
  const fullName = `${ticket.firstName} ${ticket.lastName}`.trim();
  const subject = `Richiesta ricevuta Calima - ${event.name}`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: ticket.email,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;background:#2a1208;color:#fff3d8;padding:28px">
          <div style="max-width:620px;margin:0 auto;background:#3a1508;border:1px solid #d99418;border-radius:8px;padding:24px">
            <h1 style="color:#f3a51d;margin:0 0 12px">Calima</h1>
            <p>Ciao ${fullName || 'ospite'},</p>
            <p>la tua richiesta per <strong>${event.name}</strong> e stata ricevuta.</p>
            <p>La lista viene confermata dall'organizzazione: riceverai aggiornamenti quando la richiesta sara gestita.</p>
            <p>
              <strong>Codice richiesta:</strong><br>
              <span style="font-size:24px;color:#f3a51d">${ticket.id}</span>
            </p>
            <p><strong>Data:</strong> ${event.date} - ${event.time}</p>
            <p><strong>Location:</strong> ${event.venue}, ${event.city}</p>
            <p style="margin-top:24px">
              Puoi controllare i tuoi accessi dall'area personale:
              <a href="${siteUrl}/accesso" style="color:#f3a51d">${siteUrl}/accesso</a>
            </p>
          </div>
        </div>
      `,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: payload };
  }

  return { data: payload };
}

async function sendWelcomeEmail({ email, name }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { skipped: true };
  }

  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://calima.it';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Benvenuto in Calima',
      html: `
        <div style="font-family:Arial,sans-serif;background:#2a1208;color:#fff3d8;padding:28px">
          <div style="max-width:620px;margin:0 auto;background:#3a1508;border:1px solid #d99418;border-radius:8px;padding:24px">
            <h1 style="color:#f3a51d;margin:0 0 12px">Calima</h1>
            <p>Ciao ${name || 'ospite'}, il tuo account Calima e attivo.</p>
            <p>Da qui puoi accedere alla tua area personale: <a href="${siteUrl}/accesso" style="color:#f3a51d">${siteUrl}/accesso</a></p>
          </div>
        </div>
      `,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: payload };
  }

  return { data: payload };
}

module.exports = {
  sendTicketEmail,
  sendWelcomeEmail,
};
