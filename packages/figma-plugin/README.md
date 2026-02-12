# @maxischmaxi/react-to-figma-plugin

Figma plugin that receives design specifications from the [@maxischmaxi/react-to-figma](https://www.npmjs.com/package/@maxischmaxi/react-to-figma) CLI and builds Figma designs with real shadcn component instances.

## Installation

```bash
npm install @maxischmaxi/react-to-figma-plugin
```

### Plugin in Figma laden

1. Figma Desktop App öffnen
2. In einer beliebigen Datei: **Menu → Plugins → Development → Import plugin from manifest...**
3. Zur Datei navigieren:
   ```text
   node_modules/@maxischmaxi/react-to-figma-plugin/manifest.json
   ```

4. Das Plugin erscheint jetzt unter **Plugins → Development → React to Figma**

> Das Plugin muss nur einmal importiert werden. Figma merkt sich den Pfad. Nach einem `npm install` in einem anderen Projekt muss der Pfad ggf. neu gesetzt werden.

### shadcn/ui Figma Library aktivieren

Damit das Plugin echte shadcn-Komponenten verwenden kann (statt Fallback-Rechtecke):

1. Das [shadcn/ui Community File](https://www.figma.com/community/file/1203061493325953101) in Figma öffnen
2. **"Duplicate to your Drafts"** klicken
3. In der duplizierten Datei: **Assets Panel → Library Icon (Buch) → "Publish"**
4. In deiner Arbeitsdatei: **Assets Panel → Library Icon → shadcn/ui aktivieren**

## Benutzung

1. Die CLI starten (siehe [@maxischmaxi/react-to-figma](https://www.npmjs.com/package/@maxischmaxi/react-to-figma)):
   ```bash
   npx @maxischmaxi/react-to-figma --url http://localhost:3000 --project ./my-app
   ```
2. In Figma das Plugin starten: **Plugins → Development → React to Figma**
3. WebSocket-URL eingeben (Standard: `ws://localhost:9876`)
4. **Connect** klicken
5. Das Plugin empfängt das Design und baut es automatisch auf einer neuen Seite

### Was passiert im Plugin

- Eine neue Figma-Seite wird erstellt
- Frames, Text, Rechtecke und Bilder werden aus der DesignSpec aufgebaut
- shadcn-Komponenten werden als echte Figma-Instanzen importiert (mit korrekten Variants)
- Text-Inhalte werden in die Komponenten-Instanzen geschrieben
- Am Ende zoomt Figma auf das fertige Design

### Fallback-Verhalten

Wenn ein shadcn-Komponent nicht importiert werden kann (fehlende Library oder unbekannte Komponente), wird stattdessen ein graues Rechteck mit Label erstellt. So geht kein Layout verloren.

## Voraussetzungen

- **Figma Desktop App** (das Plugin nutzt `networkAccess` für localhost — funktioniert nicht in der Browser-Version)
- **CLI muss laufen** bevor man im Plugin auf Connect klickt
