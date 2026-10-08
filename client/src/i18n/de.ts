export const de = {
  "app.name": "Fertigung Einfach",
  "app.loading": "Lädt …",
  "app.error": "Das hat nicht geklappt. Bitte erneut versuchen.",
  "app.retry": "Erneut versuchen",
  "app.localOnly": "Lokal · nicht in Odoo gebucht",

  "login.title": "Anmelden",
  "login.loginName": "Kürzel",
  "login.pin": "PIN",
  "login.submit": "Anmelden",
  "login.failed": "Kürzel oder PIN falsch.",
  "login.blocked": "Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.",
  "login.logout": "Abmelden",

  "company.label": "Firma",
  "company.switch": "Firma wechseln",

  "menu.open": "Menü öffnen",
  "menu.close": "Menü schließen",
  "menu.title": "Menü",
  "menu.notSetUp": "Noch nicht eingerichtet",
  "menu.language": "Sprache",

  "nav.group.today": "Heute",
  "nav.group.production": "Produktion",
  "nav.group.orderDelivery": "Auftrag & Lieferung",
  "nav.group.planningWarehouse": "Planung & Lager",
  "nav.group.coordination": "Koordination",
  "nav.group.communication": "Kommunikation",
  "nav.item.home": "Meine Arbeit",

  "home.now": "Jetzt tun",
  "home.next": "Danach",
  "home.waiting": "Warte auf Vincent",
  "home.labelsReady": "Etiketten bereit",
  "home.clarify": "Stopp – Klärung",
  "home.empty": "Gerade ist keine Arbeit für dich eingetragen.",
  "home.emptyHint": "Wenn etwas fehlt, melde dich bei der Koordination.",
  "home.somethingWrong": "Etwas passt nicht",

  "notFound.title": "Seite nicht gefunden",
  "notFound.back": "Zur Startseite",
} as const;

export type TranslationKey = keyof typeof de;
