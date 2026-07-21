# FranziStitch

FranziStitch ist ein vollständig lokaler Auto-Digitalisierer. SVG-Dateien und Vektorschrift werden im Browser in einen qualitätsgeprüften Stichplan und anschließend in eine Tajima-DST-Datei umgewandelt.

## Funktionen

- SVG-Pfade, Grundformen, Kurven, Löcher und Transformationen
- Sieben vektorbasierte Schriften mit Umlauten: Noto Sans, Montserrat, Bungee, Noto Serif, Playfair Display, Pacifico und Lobster
- Deutsch/Englisch-Umschalter und vier eingebettete Beispielmotive
- Laufstich, Tatami und automatische beziehungsweise manuelle Satin-Auswahl
- Kanten-, Mittel- und Tatami-Unterlage
- Stoffprofile für Webware, dehnbare Stoffe und Frottee
- Zugausgleich, Kurzstichfilter, Vernähstiche und optionale Schnittsequenzen
- Objektliste mit Reihenfolge, Sichtbarkeit, Farbe und individuellen Stichparametern
- Verschieben, Drehen, Skalieren, Spiegeln, Duplizieren sowie Undo/Redo
- Qualitätsprüfung für Rahmengrenzen, Kleinstteile, breite Satinflächen und lange Sprünge
- Abspielbare Stichsimulation
- Lokales, versioniertes `.franzistitch.json`-Projektformat; alte `.stitchlite.json`-Projekte bleiben lesbar
- Binärer Tajima-DST-Export
- Worker-basierte Berechnung ohne Uploads oder Server

## Lokal starten

```bash
npm install
npm run dev
```

## Prüfen und bauen

```bash
npm run check
```

## Produktionshinweis

Automatische Digitalisierung bleibt eine Ausgangsbasis. Maschinen, Garne, Nadeln, Stabilisatoren und Stoffe reagieren unterschiedlich. Vor jeder Produktion ist ein Probestick erforderlich.
