# Validation and evidence

## Three separate evidence levels

1. **Static export evidence:** four workflows and their node configuration, connections, parser schema, expressions, and JavaScript.
2. **Offline regression checks:** runnable structural/sanitization checks and selected Code-node tests with mocked n8n context. No service calls or AI classification.
3. **Live integration evidence:** must be recorded in a configured n8n test environment. Historical portfolio-reported 10/10 requests are not re-established by `npm test`.

## Before an end-to-end demonstration

- Confirm all placeholders are replaced and credentials point only to test resources.
- Confirm Header Auth rejects missing and invalid credentials.
- Confirm all three operational workflows select the imported Error Handler.
- Confirm the intake poll, SLA interval, timezone, Gmail label and table columns.
- Keep private execution logs outside the repository. Never attach unredacted inbox or credential screenshots.

## Integration checklist — not marked as passed by this package

| Scenario | Expected observation |
| --- | --- |
| Synthetic student-support request | Structured classification, matching owner/SLA, one ticket row and team notification |
| Double-charge / paid-access failure | Inspect whether the model applies the P1 policy |
| Refund without immediate financial loss | Inspect whether the model applies P2 |
| Academic or sales request | Matching category, role and SLA; no cross-field mismatch |
| Genuine short customer request | Not incorrectly filtered as spam |
| Spam | `filtered` row, no normal team notification, Gmail label added |
| Duplicate Gmail message | No second ticket row |
| Deadline, +30 and +60 overdue minutes | L0/L1/L2 destination and persisted level; no repeat on next successful run |
| First check at +65 minutes | L2 only; earlier levels are not replayed |
| Several overdue tickets | Correct per-ticket item linking, notifications and state updates |
| Valid lifecycle event, existing ticket | HTTP 200 and correct timestamps/state |
| Valid lifecycle event, absent ticket | HTTP 404 and `ticket_not_found` |
| Invalid event or reopen attempt | Capture actual error response; do not claim explicit 400/409 handling |
| Controlled node failure | Error Log entry and administrator Slack alert in an automatic execution |
| Sheets write fails after notification | Observe duplicate-alert risk; do not claim exactly-once delivery |
| Friday close, weekend, Madrid DST change | Confirm the actual business-minute deadline in n8n |

The examples included here are synthetic and newly written. They are not the original ten-request test dataset. Record n8n version, timestamp, configuration, test inputs, expected and observed results when collecting new integration evidence.
