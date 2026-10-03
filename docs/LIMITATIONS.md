# Prototype limitations and engineering next steps

The GitHub preparation preserves the supplied implementation rather than silently redesigning it. These boundaries are important when interpreting the demo.

## Reliability

- Duplicate lookup plus append in Google Sheets is not an atomic transaction. Concurrent runs can race and insert duplicate tickets.
- Escalation messages are sent before their level is persisted. A successful send followed by a failed Sheets update can produce a repeat alert. A late first check can jump directly to L1/L2.
- The Error Handler writes the log before sending its Slack alert. A log-write failure can prevent that alert; no independent fallback path is implemented.
- Multi-item n8n linking and post-notification mappings must be verified after import, especially when several tickets are overdue simultaneously.
- Retries exist on selected nodes; this is not a complete recovery/replay design. Gmail's `newer_than:1d` intake filter may miss old unprocessed mail after a prolonged outage. There is no backfill workflow.

## Classification

- The JSON parser validates individual allowed values, not all cross-field business invariants. Category-to-owner and priority-to-SLA mappings are prompt instructions, not fully enforced code rules.
- There is no confidence-based human review queue or measured long-term accuracy report.
- Email text is untrusted input. Prompt-injection resistance and misclassification recovery require separate adversarial testing before client use.
- Notifications use role labels, not validated Slack user mentions. Assignment does not by itself confirm an owner has seen the ticket.

## Time and lifecycle semantics

- SLA budgets are **business minutes**, not calendar minutes. P3's 1,440 minutes spans multiple ten-hour working days; it does not mean a 24-hour calendar deadline.
- Deadlines exclude weekends; the holiday set is empty. The monitor's overdue clock is elapsed time and can escalate outside business hours.
- Lifecycle accepts `in_progress` and `closed`, permits direct closure, and prevents reopening a closed ticket. It is not a complete state machine.
- Closing without a recorded first response sets `first_response_at` to the event time or current time. Caller-supplied timestamps are not validated for chronology or format.
- Validation failures throw errors; explicit 400/409 webhook responses, per-owner authorization, rate limiting, and replay protection are not implemented.

## Data and measurement

- Gmail contents are sent to the model; summaries and error details are sent to connected services. There is no automatic personal-data redaction in the runtime flows.
- Logs may contain message text, execution URLs, or secrets embedded in an upstream error. Retention, access controls, and log sanitization must be designed before production use.
- The reported ten-request demo is not a load test or a guarantee of future accuracy. The assumed 35–50/day volume is not a measured processing capacity.
- Offline tests do not validate OAuth permissions, service responses, AI output, Luxon business-hour calculations, or n8n execution behaviour.

## Sensible next steps

Add deterministic cross-field validation and a human-review route; validate lifecycle events and timestamps; verify calendar boundaries and daylight-saving transitions; introduce atomic persistence and notification recovery; test multi-item linking, outages, and alert fallback; define data retention and consent. None of these extensions are claimed as already implemented.
