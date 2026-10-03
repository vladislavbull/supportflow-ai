# Setup guide

Use a separate n8n test instance, an isolated Gmail inbox, a test spreadsheet, and private Slack channels. The workflows can transmit ticket contents to OpenAI, Google, and Slack and can send email. Do not connect a live customer inbox for the first run.

## 1. Import

Import `04-error-handler.json` first, then the other three exports. Leave triggers unpublished while configuring them. The source node `typeVersion` values are preserved, but the source n8n application version is unknown; verify node compatibility in your instance.

These sanitized files keep the original workflow topology, node names, prompts, Code-node logic, and routing expressions. They deliberately omit deployment-specific identifiers and credential bindings.

## 2. Credentials

Create or select credentials in n8n, never in a repository:

| Credential | Nodes |
| --- | --- |
| Gmail OAuth2 | Intake trigger, `Ticketed` label node, L2 email node |
| Google Sheets OAuth2 | All Sheets nodes |
| Slack OAuth2 | Intake, L0/L1 reminders, administrator alert |
| OpenAI | Chat Model node; the source model selection is `gpt-5-mini` |
| Header Auth | Lifecycle webhook: set the header name to `X-SupportFlow-Key` and choose your own secret |

Header authentication remains enabled in the lifecycle export. Removing credential bindings is not a reason to disable authentication. Validate it after import.

## 3. Spreadsheet

Create tabs named `Tickets` and `Error Log`. Use these files as header templates, not as customer datasets:

- `examples/tickets-header.csv`
- `examples/error-log-header.csv`

Replace `REPLACE_WITH_SPREADSHEET_ID` in **every** Google Sheets node. Tabs are selected by name. Refresh column mappings in the UI and ensure `ticket_id` is the matching column for update nodes. Preserve timestamp fields as ISO strings.

## 4. Channels and recipients

Replace:

- `REPLACE_WITH_SUPPORT_CHANNEL_ID` in intake and L0/L1 Slack nodes.
- `REPLACE_WITH_ALERTS_CHANNEL_ID` in the Error Handler.
- `director@example.com` in the L2 Gmail node with your test recipient.
- `automation@example.com` in the Gmail trigger query with the sender account used for escalation email. This prevents escalation mail from being re-ingested.
- `REPLACE_WITH_TICKETED_LABEL_ID` with the ID of a Gmail label named `Ticketed` in your test inbox.

The role names in notifications are text, not Slack user mentions or direct-message routing. Confirm that owners monitor the selected support channel, or implement actual user mapping as a separate change.

## 5. Settings and schedules

Select the newly imported Error Handler in the **Error workflow** setting of Intake, SLA Monitor, and Lifecycle. Source error-workflow IDs were removed because they do not resolve in another instance.

Confirm Gmail polling is once per minute with `maxResults: 1`. Confirm the SLA schedule is once every five minutes: the source export stores `field: minutes` and relies on the node default for its interval. Set it explicitly to five minutes in your instance. [Schedule Trigger documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/).

Set the workflow timezone to `Europe/Madrid`. The source business-hours code uses that timezone directly. Its holiday set is empty; add a holiday calendar only as a separately tested configuration change.

## 6. Lifecycle request

Use the generated test URL for the lifecycle webhook. Create a matching synthetic ticket in `Tickets` first. Use `examples/lifecycle-event.json` as the request body. Supply your Header Auth credential through an HTTP client without placing its secret in a checked-in file or screenshot.

Expected controlled responses:

- Existing ticket and valid event: HTTP 200, `ok: true`.
- Missing ticket and valid event: HTTP 404, `error: ticket_not_found`.

Malformed events and prohibited reopen attempts currently throw node errors; there is no explicit HTTP 400/409 response branch. Test the actual client response rather than assuming one.

## 7. Validate, then publish test triggers

Run the offline checks with `npm test`. Complete `docs/VALIDATION.md` in n8n using only synthetic requests. Verify multi-item linking and escalation-state updates with several due tickets in one execution.

Publish only after credential, destination, and authentication checks are complete. Deactivate test triggers after the demonstration. Publishing in n8n means enabling test workflow execution; it does not make this a verified client deployment.

## Official references

- [Workflow export and import](https://docs.n8n.io/build/manage-workflows/export-and-import.md)
- [Error workflow handling](https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md)
- [Google Sheets node resource locator implementation](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Google/Sheet/v2/actions/sheet/Sheet.resource.ts)
