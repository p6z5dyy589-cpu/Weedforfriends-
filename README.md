# Weed for Friends · 3D-Webseite

Eine interaktive 3D-Landingpage, gebaut mit [Three.js](https://threejs.org/).
Die Seite zeigt schwebende, prozedural erzeugte Cannabis-Blätter, einen
Partikel-Effekt sowie Maus- und Scroll-gesteuerte Kamerabewegungen.

## Features

- 🧊 **Interaktive WebGL-Szene** – läuft direkt im Browser, ohne Plugins
- 🌿 **Prozedurale 3D-Blätter** – mit `THREE.ExtrudeGeometry` erzeugt
- ✨ **Partikel & Beleuchtung** – additive Glühpunkte und mehrere Lichtquellen
- 🖱️ **Parallax** – Kamera reagiert auf Maus und Scrollposition
- 🎨 **Modernes UI** – Glassmorphism, Verläufe, responsive

## Lokal starten

Da die Seite ES-Module nutzt, muss sie über einen Webserver geladen werden
(nicht per `file://`). Am einfachsten:

```bash
# Python 3
python3 -m http.server 8000

# oder Node
npx serve .
```

Danach im Browser öffnen: <http://localhost:8000>

## Struktur

| Datei         | Inhalt                                   |
| ------------- | ---------------------------------------- |
| `index.html`  | Seitenaufbau + Import-Map für Three.js   |
| `styles.css`  | Styling, Layout, Glassmorphism           |
| `main.js`     | Three.js-Szene, Animation, Interaktion   |

## Technik

Three.js wird per CDN über eine
[Import-Map](https://developer.mozilla.org/de/docs/Web/HTML/Element/script/type/importmap)
geladen – es ist **kein Build-Schritt** nötig.
