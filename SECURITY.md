# Security notes

## Safe exports

The prepared workflow copies contain no original credential bindings, spreadsheet addresses, Slack channel IDs, Gmail label IDs, recipient email addresses, instance IDs, source workflow/version IDs, pinned execution data, or linked error-workflow IDs. Node-local IDs remain to preserve the canvas. The webhook route name is retained, but its source webhook ID is removed.

The automated scan checks known secret patterns and deployment metadata, not every possible secret format. Manual review is still required before publication. Do not publish credential exports, `.env` files, private execution logs, customer tickets, or unredacted screenshots.

## Runtime privacy

Intake sends the sender, subject, and message body to the configured model. Tickets are stored in Google Sheets and summaries sent to Slack; L2 sends an email. The Error Handler stores full error messages and stacks. This public-preparation sanitization does not add runtime redaction.

Use synthetic data first. Before real customer use, establish consent/legal basis, least-privilege access, retention policies, and redaction rules for all connected services. Do not expose the lifecycle endpoint without Header Auth. The prototype does not implement per-owner authorization or replay protection.

## Reporting a concern

Contact Vladyslav privately through [LinkedIn](https://www.linkedin.com/in/vladyslav-moskalkov/). Do not include secrets or customer data in a public issue. If a real credential is exposed, revoke or rotate it and treat removal from the latest file as insufficient: Git history can retain it.
