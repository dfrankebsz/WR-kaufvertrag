# Kaufvertrag Quest – LoopLab Academy

Responsive Lern-App zu Kaufverträgen mit **120 Übungen**, Kursnavigation, Lösungen, AFB-I–III-Kennzeichnung, Abschlusscheck, XP, Avatar-Shop und Lehrerbereich. Basierend auf den mitgelieferten Präsentations-, Übungs- und SCORM-Unterlagen.

## Deployment mit GitHub und Netlify

1. ZIP entpacken. **Den Inhalt des Projektordners** in ein neues GitHub-Repository hochladen (`package.json`, `netlify.toml`, `public`, `netlify`). ZIP nicht unverändert als eine einzelne Datei ins Repository legen.
2. In Netlify: **Add new project → Import an existing project → GitHub** und Repository auswählen.
3. Build command **leer lassen**, Publish directory `public`, Functions directory `netlify/functions` (bereits in `netlify.toml` hinterlegt). Netlify installiert die Node-Abhängigkeiten des `package.json` automatisch.
4. Unter **Project configuration → Environment variables** die Variable `TEACHER_INVITE_CODE` anlegen. Wert: **selbstgewählter, zufällig generierter Code mit mindestens 12 Zeichen**. **Nur in Netlify**, niemals in GitHub oder im Frontend. Nach Anlage Deployment neu auslösen.
5. Öffnen: **Anmelden → Lehrerkonto anlegen**, Nickname, Klasse, Passwort (mindestens zehn Zeichen), Lehrer-Code. Danach können Schüler mit derselben Klassenbezeichnung eigene Nicknames und Passwörter anlegen.
6. Die **Netlify-Blobs-Stores** `kv-users`, `kv-sessions`, `kv-progress` werden bei den ersten entsprechenden Requests automatisch genutzt. Kein SQL-Editor, keine Supabase-Datenbank, keine globale `AUTH`-Variable nötig.

### Vorabtest

Mit einem Netlify-Deploy prüfen: Registrierung Lehrkraft, Registrierung Schüler mit gleicher Klasse, Anmeldung in einem zweiten Browser/Endgerät, Fortschrittsspeicherung, Lehrerbereich, Passwort-Reset, Klassen-Reset und PDF-Druck. Lokales bloßes Öffnen von `index.html` funktioniert für den Gastkurs nicht zuverlässig, weil `course.json` über einen Webserver geladen wird. Für lokale Entwicklung: `npm install`, `npx netlify dev`.

## Technische Hinweise und Grenzen

- Die Registrierung eines Schülers erfordert nur Kenntnis des Klassennamens. Das ist **keine geheime Klasseneinladung**. Der Lehrer-Code schützt nur die Lehrkraftregistrierung.
- Die Klasse begrenzt die Lehreransicht. Lehrer können nur Konten ihrer Klasse sehen, bearbeiten und löschen. Verwenden Sie eindeutige Klassennamen.
- Daten liegen in Netlify Blobs; Speicherung erfolgt serverseitig, Passwörter werden mit **scrypt + individuellem Salt** gehasht. Sessions sind zufällig und auf 30 Tage begrenzt; das Token bleibt bis zum Schließen des Tabs in `sessionStorage`. Ein zurückgesetztes Passwort verhindert neue Logins mit dem alten Passwort; bereits existierende Sessions werden beim nächsten Zugriff nach Passwortänderung oder Passwort-Reset ungültig.
- **Kein Rate Limiting**, keine Captchas, keine Emailverifikation und **keine manipulationssichere XP-Berechnung** (Spielpunkte liegen im Client-Fortschritt). Für benotete Prüfungen ist das System nicht geeignet. Ebenso fehlt ein automatisiertes Backup und ein vollständiges Self-Service-Lösch- bzw. Datenschutzportal.
- Beim Anlegen eines Schülerkontos wird ein auf dem Gerät vorhandener Gastfortschritt einmalig übernommen.
- Nach Lehrer-Reset von Fortschritt bzw. Passwort werden bestehende Sitzungen der betroffenen Schüler beim nächsten API-Zugriff ungültig.
- Bei mehreren parallelen Geräten gilt **letzte vollständige Speicherung gewinnt**; bei gleichzeitigem Arbeiten kann Fortschritt überschrieben werden. Nutzen Sie den Kurs möglichst nicht parallel auf mehreren Geräten.
- Für produktiven Schuleinsatz sind eine Datenschutz-Folgenprüfung bzw. schulische Prüfung von Auftragsverarbeitung, Rechtsgrundlage, Löschfrist, Hosting, Einwilligung soweit erforderlich, Informationspflichten und dem Einsatz mit Minderjährigen notwendig. Klarnamen vermeiden.
- Der Lösungsbestand ist eine didaktisch überarbeitete Interpretation der Vorlagen, keine verifizierte 1:1-Transkription jeder Bildzelle. Die Datei `QUELLENABGLEICH.md` dokumentiert die Übernahme und Korrekturen. Bitte alle Materialien vor Unterrichtseinsatz gegenprüfen.
- Die Original-QR-Code-Links aus der Präsentation wurden durch inhaltlich verwandte interne Aufgabentypen ersetzt; es handelt sich **nicht** um eine exakte Rekonstruktion der externen LearningApps-Angebote.
- Die Musterlösung kann im Gast- und Kontomodus angezeigt werden. Freitexte werden nur selbst bewertet. PDF-Ausgabe über den Betriebssystem-/Browserdruckdialog.

## Projektdateien

- `public/index.html` Einstieg
- `public/styles.css` Responsive Layout und Druck
- `public/app.js` Aufgabe-Engine, Gamification und UI
- `public/course.json` bearbeitbare Unterrichtsinhalte mit Aufgabenquellen und AFB
- `netlify/functions/api.mjs` Klassen, Authentifizierung, Speicherung, Lehrerbereich
- `netlify.toml` Netlify-Konfiguration, Sicherheitsheader und Redirect
- `QUELLENABGLEICH.md` Lernstationen und Dokumentationshinweise

## Wartung

In `public/course.json` können Sie Aufgabentexte und Lösungen ergänzen. Vor Änderung IDs sichern, da Speichereinträge auf den IDs beruhen. Quiz-Typen: `single`, `multi`, `tf`, `number`, `text`, `match`. Die Lösung bei `match` ist eine Liste von `[Aussage, passende Zuordnung]`. Bei `number` eine Dezimalzahl. Änderung erfolgt via Push auf GitHub und automatisches Netlify-Deployment.
