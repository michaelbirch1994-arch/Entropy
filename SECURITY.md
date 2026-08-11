# Security

Entropy is a browser-based Guild Wars 2 WvW report viewer. Combat logs you
choose to import are uploaded to [dps.report](https://dps.report) for parsing.
The app does not collect telemetry. Beyond dps.report (and any Discord webhook
URL you optionally configure), it does not send data to third-party analytics
or backend services owned by this project.

Folder watching uses the browser File System Access API: you must explicitly
pick a folder, and access is limited to that grant for the current origin.

## Reporting a vulnerability

If you find a security issue — for example a bug that could let a malicious
combat log or dps.report response execute code in the browser — please open a
GitHub security advisory (preferred for exploitable bugs) or a regular issue
for lower-severity concerns. GitHub is the contact point for this project.

## Trust boundaries

- **User-selected files only**: the app only reads files you upload or folders
  you connect through the browser picker.
- **dps.report**: raw logs are posted to dps.report's public upload API; parsed
  JSON is fetched back by permalink.
- **Local storage**: report archives and profile data stay in the browser
  (IndexedDB / localStorage) on your device.
- **Optional Discord webhooks**: if you paste a webhook URL, report summaries
  are POSTed only to that URL.
- **Source availability**: this project is GPL-3.0 licensed so the client
  behavior can be audited before use.
