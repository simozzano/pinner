# Pinner

PWA per segnare icone colorate (con etichetta) sui giorni di un calendario, con statistiche di frequenza per settimana/mese. I dati stanno in un Google Sheet, raggiunto tramite Google Apps Script.

## 1. Backend (Google Sheet + Apps Script)

1. Crea un nuovo Google Sheet.
2. **Estensioni → Apps Script**, incolla il contenuto di [apps-script/Code.gs](apps-script/Code.gs).
3. Cambia `SECRET` con una stringa a tua scelta.
4. **Distribuisci → Nuova distribuzione → Tipo: App web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
5. Autorizza i permessi e copia l'URL che termina con `/exec`.

I fogli `Icons` ed `Entries` vengono creati automaticamente al primo accesso.
Se modifichi il codice, crea una **nuova versione** della distribuzione (l'URL resta lo stesso).

> Sicurezza: l'URL è pubblico, la protezione è il token `SECRET`. Non condividerli.

## 2. Pubblicazione su GitHub Pages

1. Pusha il repo su GitHub.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, cartella `/ (root)`.
3. Apri `https://<utente>.github.io/<repo>/`.

## 3. Configurazione app

Incolla l'URL `/exec` in [config.js](config.js) e fai commit/push. Poi, nella scheda **Impostazioni** dell'app, inserisci solo la password (`SECRET`). Su mobile usa "Aggiungi a schermata Home" per installarla.

## Funzionamento

- **Icone**: emoji + etichetta + colore, mostrate in un cerchio colorato.
- **Calendario**: vista settimana/mese; tocca un giorno per attivare una o più icone.
- **Statistiche**: per settimana/mese, giorni con l'icona / giorni del periodo = %. Nel periodo corrente i giorni futuri non vengono contati.
- **Offline**: i dati sono in cache locale; le modifiche non inviate vengono risincronizzate appena c'è rete.
