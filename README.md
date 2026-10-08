# Fertigung Einfach

Mobile Mitarbeiter-App (Deutsch/Tschechisch) für Fertigung, Prüfung, Abpackung, Packen,
Wareneingang, Lagerorientierung, Anwesenheit/Vertretung und Kommunikation.

> **Grundsatz:** Die App führt Menschen durch reale Arbeit. Odoo bestätigt später, was
> tatsächlich produziert, gebucht, bezahlt, reserviert, geliefert oder auf Lager ist.

## Stand: lokale Prozessschicht (`local_unbooked`)

Alles in dieser Version ist **lokal und nicht mit Odoo verbunden**. Jede Ansicht zeigt
„Lokal · nicht in Odoo gebucht“. Ein lokaler Status bedeutet nie Odoo-fertig, gebucht,
reserviert, bezahlt oder versendet.

Bewusst **nicht** enthalten (jeweils eigenes, freizugebendes Paket – Handbuch Kap. 15):
Odoo-Lese-/Schreibzugriffe, Druck, Push, Slack, Deputy, KI-Fotoanalyse, Versand-Wizard,
Zahlungsstatus. WhatsApp/respond.io bleiben deaktiviert.

| Bereich | Route | Rollen |
|---|---|---|
| Mein Tag (Jetzt / Danach / Warten / Klärung) | `/` | alle |
| Arbeitsplatz (Mein Tag, Team, Blockiert, Lieferbereit) | `/arbeitsplatz` | alle |
| Aufgabe: geführter Schritt, Foto, Material/Lots, Übergabe, Packliste | `/aufgabe/:id` | je nach Aufgabe |
| Vincent-Prüfung (Prüfblatt, lokale Freigabe) | `/pruefung` | reviewer, qm |
| Packen & Übergabe (anbieten → annehmen → abhaken) | `/packen` | pack, shipping, coordinator |
| Produktionsplanung (nur ungestartete Arbeit) | `/planung` | planner, coordinator |
| Neue Aufgabe / WFF-Vorlage Bulk → Abpackung → Packen | `/aufgabe-neu` | planner, coordinator, reviewer (incoming: nur Wareneingang) |
| Wareneingang (lokale Prüfung, Buchung bleibt in Odoo) | `/wareneingang` | incoming, coordinator |
| Lagerkarte (nur Orientierung, QR/Text) | `/lagerkarte` | alle (bearbeiten: coordinator) |
| Leitstand | `/leitstand` | coordinator, reviewer, planner |
| Anwesenheit & Vertretung | `/team` | coordinator |
| Zuständigkeiten (Produktfamilie → Primär/Stellvertretung) | `/zustaendigkeiten` | coordinator |
| Personen, Rollen, PIN | `/personen` | coordinator |
| Benachrichtigungen, Team-/Direkt-/Auftragschat | `/nachrichten`, `/chat` | alle |

Rollen: `production`, `reviewer`, `planner`, `qm`, `pack`, `shipping`, `incoming`,
`coordinator` – pro Person **und pro Firma** (Solovya = 1, Xenon = 2).

## Technik

React 19, TypeScript, Vite, Tailwind 4, Radix, Wouter, Express 4, tRPC 11,
Drizzle/MySQL, Vitest.

```
client/src/        Oberfläche (pages/, components/, i18n/modules/*)
server/            tRPC-Router, Domänenregeln (domain/), Speicher (store/), Fotos (files/), CLI (cli/)
shared/            Typen und reine Fachregeln (Client + Server)
drizzle/           Schema und Migrationen
```

### Sicherheitsmodell

- Persönliche Kiosk-Sitzung (Kürzel + PIN, scrypt-Hash, Sperre nach Fehlversuchen,
  HttpOnly-Cookie, nur Token-Hash gespeichert).
- Aktive Firma kommt **nur** aus der Server-Sitzung und wird bei jeder Anfrage gegen die
  Firmenfreigabe geprüft. Fremde Objekte antworten wie nicht vorhandene (`NOT_FOUND`).
- Jede Änderung trägt `requestId` (Idempotenz) und die angezeigte Firma; hat die Sitzung
  inzwischen eine andere Firma, wird die Aktion abgelehnt (`company_changed`).
- Versionsschutz auf jedem Datensatz, atomarer Commit, append-only Ereignisse.
- Fotos: echte Bildtyp-Prüfung (Magic Bytes), max. 8 MB, firmengebunden, im Browser
  verkleinert (entfernt dabei EXIF/GPS).

## Einrichtung auf dem Mac (empfohlen)

```bash
git clone -b claude/3d-website-xTqWL https://github.com/p6z5dyy589-cpu/Weedforfriends-.git fertigung-einfach
cd fertigung-einfach
bash scripts/setup-mac.sh     # installiert Node, pnpm, MySQL, legt DB + .env an, fragt den ersten Koordinator ab
pnpm dev                      # http://localhost:3000
```

Voraussetzung: [Homebrew](https://brew.sh). Die Zugangsdaten landen in `.env` (wird nicht
committet). Das iPhone im selben WLAN erreicht die App über die IP des Mac (zeigt das Skript an).

## Einrichtung (allgemein)

```bash
pnpm install
export DATABASE_URL="mysql://user:pass@host:3306/fertigung"
pnpm db:migrate                       # Migrationen in ./drizzle anwenden
pnpm admin:create-coordinator --login vincent --name "Vincent" --companies 1,2
                                      # PIN wird verdeckt abgefragt
pnpm dev                              # Entwicklung (Vite + API auf Port 3000)
pnpm build && pnpm start              # Produktion
```

Umgebungsvariablen: `DATABASE_URL` (Pflicht), `PORT` (Standard 3000),
`UPLOAD_DIR` (Fotos, Standard `./uploads`). Weitere Personen legt die Koordination
danach in der App unter **Personen** an.

## Prüfungen

```bash
pnpm check        # TypeScript
pnpm test         # isolierte Standardsuite – ohne Datenbank, Odoo oder Secrets
pnpm build
git diff --check
```

Zusätzlich, nur gegen eine **Wegwerf-Testdatenbank** (Name muss „test“ enthalten):

```bash
TEST_DATABASE_URL="mysql://user:pass@localhost:3306/fe_test" pnpm test:db
```

`pnpm test:live` ist für spätere Live-Tests reserviert und startet nur mit
`ALLOW_LIVE_TESTS=1`.

## Schemaänderungen

```bash
pnpm db:generate     # erzeugt SQL in ./drizzle – vollständig lesen, dann anwenden
```

Bestehende Migrationen werden nie umgeschrieben. Die Spalte `kiosk_users.role` ist seit
Migration 0001 ungenutzt (Rollen liegen pro Firma in `kiosk_user_companies.roles`);
ihr Entfernen wäre eine destruktive Migration und braucht eine eigene Freigabe.
