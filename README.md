# FranziStitch

FranziStitch ist ein statischer Auto-Digitalisierer für GitHub Pages. SVG-Dateien und Vektorschrift werden im Browser in einen qualitätsgeprüften Stichplan und anschließend in ein Maschinenformat umgewandelt.

## Funktionen

- SVG-Pfade, Grundformen, Kurven, Löcher und Transformationen
- Sieben vektorbasierte Schriften mit Umlauten: Noto Sans, Montserrat, Bungee, Noto Serif, Playfair Display, Pacifico und Lobster
- Deutsch/Englisch-Umschalter und vier eingebettete Beispielmotive
- Laufstich, Tatami und automatische beziehungsweise manuelle Satin-Auswahl
- Kanten-, Mittel- und Tatami-Unterlage
- Stoffprofile für Webware, dehnbare Stoffe und Frottee
- Maschinen-Presets für Universal/Tajima, Melco sowie Janome/Elna
- Zugausgleich, Kurzstichfilter, Vernähstiche und optionale Schnittsequenzen
- Objektliste mit Reihenfolge, Sichtbarkeit, Farbe und individuellen Stichparametern
- Verschieben, Drehen, Skalieren, Spiegeln, Duplizieren sowie Undo/Redo
- Qualitätsprüfung für Rahmengrenzen, Kleinstteile, breite Satinflächen und lange Sprünge
- Abspielbare Stichsimulation
- Lokales, versioniertes `.franzistitch.json`-Projektformat; alte `.stitchlite.json`-Projekte bleiben lesbar
- Binärer Export in Tajima DST, Melco EXP und Janome JEF
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

Der statische Build landet in `dist/` und verwendet relative Asset-Pfade. Er funktioniert dadurch unter `https://BENUTZER.github.io/REPOSITORY/`.

## GitHub Pages aktivieren

1. Repository zu GitHub pushen.
2. Unter **Settings → Pages** als Quelle **GitHub Actions** wählen.
3. Einen Push auf `main` ausführen oder den Workflow manuell starten.

## Produktionshinweis

Automatische Digitalisierung bleibt eine Ausgangsbasis. Maschinen, Garne, Nadeln, Stabilisatoren und Stoffe reagieren unterschiedlich. Vor jeder Produktion ist ein Probestick erforderlich.

## Hinweise zu Formatkompatibilität

Das Maschinen-Preset wählt ein übliches Dateiformat und passendes Sprung-/Schnittverhalten. Die tatsächlich unterstützten Formate, Rahmenmaße und Stichlimits müssen am konkreten Maschinenmodell geprüft werden. Herstellerbezeichnungen dienen ausschließlich der Kompatibilitätsbeschreibung; FranziStitch ist mit diesen Herstellern nicht verbunden.

Technische Details der EXP- und JEF-Formate sowie die JEF-Farbpalette wurden unter anderem gegen das MIT-lizenzierte Projekt [pyembroidery](https://github.com/EmbroidePy/pyembroidery) geprüft. Die Lizenz ist in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) wiedergegeben.
