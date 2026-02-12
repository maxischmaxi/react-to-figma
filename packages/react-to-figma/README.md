# @maxischmaxi/react-to-figma

CLI-Tool das eine laufende React/shadcn-App analysiert und ein Figma-Design daraus erstellt — mit echten shadcn-Komponenten-Instanzen.

## Installation

```bash
npm install -g @maxischmaxi/react-to-figma
npx playwright install chromium
```

Oder direkt mit `npx` (ohne globale Installation):

```bash
npx @maxischmaxi/react-to-figma --url http://localhost:3000 --project ./my-app
```

## Voraussetzungen

- **Node.js** >= 20
- **`ANTHROPIC_API_KEY`** als Umgebungsvariable gesetzt (für Claude Vision API)
- Die React-App muss lokal laufen und über URL erreichbar sein
- Das Figma-Plugin muss installiert sein: [@maxischmaxi/react-to-figma-plugin](https://www.npmjs.com/package/@maxischmaxi/react-to-figma-plugin)

## Benutzung

### 1. React-App starten

```bash
# In deinem React-Projekt
npm run dev
# App läuft z.B. auf http://localhost:3000
```

### 2. CLI ausführen

```bash
react-to-figma --url http://localhost:3000 --project ./path-to-your-app
```

Die CLI durchläuft 4 Schritte:

```text
[1/4] Capturing screenshot...
      Screenshot captured: 1440x900 (page height: 1200px)

[2/4] Reading project code...
      Found 5 relevant files
      Detected 12 shadcn component usages

[3/4] Analyzing with Claude...
      Generated DesignSpec: "Dashboard" with 8 top-level nodes

[4/4] Starting WebSocket server...
      Open Figma → Plugins → React to Figma → Connect to ws://localhost:9876
```

### 3. Figma-Plugin verbinden

Sobald die CLI bei Schritt 4 wartet:

1. Figma öffnen → **Plugins → Development → React to Figma**
2. `ws://localhost:9876` eingeben → **Connect**
3. Das Design wird automatisch erstellt

## Optionen

| Flag | Default | Beschreibung |
|------|---------|--------------|
| `--url <url>` | (required) | URL der laufenden React-App |
| `--project <path>` | (required) | Pfad zum React-Projekt (Quellcode) |
| `--port <number>` | `9876` | Port für den WebSocket-Server |
| `--width <number>` | `1440` | Viewport-Breite in Pixeln |
| `--height <number>` | `900` | Viewport-Höhe in Pixeln |

## Beispiele

```bash
# Standard: 1440px Viewport
react-to-figma --url http://localhost:3000 --project ./my-app

# Mobile Viewport
react-to-figma --url http://localhost:3000 --project ./my-app --width 375 --height 812

# Anderer Port
react-to-figma --url http://localhost:5173 --project ../my-vite-app --port 8080
```

## Was die CLI erkennt

### shadcn-Imports

Die CLI findet automatisch alle `.tsx`/`.jsx`-Dateien die shadcn-Komponenten importieren:

```tsx
import { Button } from "@/components/ui/button"   // ✓ erkannt
import { Card } from "~/components/ui/card"        // ✓ erkannt
import { Input } from "../components/ui/input"     // ✓ erkannt
```

### Unterstützte Komponenten

Button, Card (+ CardHeader, CardTitle, CardDescription, CardContent, CardFooter), Input, Badge, Label, Separator, Avatar, Alert, Checkbox, Select, Switch, Textarea.

Nicht erkannte Komponenten werden als Frames oder Rechtecke dargestellt.

### Code-Analyse

- Babel AST-Parser erkennt JSX-Komponenten mit Props und Text-Inhalten
- Tailwind-Klassen werden von Claude in Figma-Layout-Properties übersetzt (Spacing, Padding, Flex-Direction etc.)
- Quellcode wird auf 50KB begrenzt um das Claude Context-Fenster nicht zu sprengen

## Wie es funktioniert

```bash
React-App (läuft)
    ↓  Playwright
Screenshot (PNG)
    ↓
    +  Quellcode (via Babel AST)
    ↓  Claude Vision API
DesignSpec (JSON)
    ↓  WebSocket
Figma Plugin
    ↓  Figma Plugin API
Fertiges Design in Figma
```

1. **Screenshot**: Playwright öffnet headless Chrome, navigiert zur URL, macht einen Viewport-Screenshot
2. **Code-Analyse**: Babel parsed alle TSX/JSX-Dateien, erkennt shadcn-Imports und extrahiert Komponenten-Nutzung
3. **AI-Analyse**: Claude bekommt Screenshot + Code und produziert ein strukturiertes DesignSpec-JSON mit Positionen, Größen, Farben und Komponenten-Infos
4. **WebSocket**: Die CLI startet einen lokalen WebSocket-Server und wartet auf das Figma-Plugin (Timeout: 5 Minuten)

## Troubleshooting

**"ANTHROPIC_API_KEY not set"**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**Playwright-Browser nicht installiert**
```bash
npx playwright install chromium
```

**WebSocket-Timeout (5 Minuten)**
Das Plugin muss sich innerhalb von 5 Minuten verbinden. Falls die Zeit abläuft, CLI neu starten.

**Claude gibt ungültiges JSON zurück**
Die CLI versucht automatisch bis zu 2 Retries. Falls es weiterhin fehlschlägt, könnte die Seite zu komplex sein — versuche einen kleineren Viewport (`--width 1024`).
