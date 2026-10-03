import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = fs.readdirSync(path.join(root, 'workflows')).filter(f => f.endsWith('.json')).sort();
const workflows = files.map(f => JSON.parse(fs.readFileSync(path.join(root, 'workflows', f), 'utf8')));
const [intake, sla, lifecycle, errorHandler] = workflows;
const nodesOf = w => new Map(w.nodes.map(n => [n.name,n]));
const code = (w,name) => nodesOf(w).get(name).parameters.jsCode;

test('exactly four expected workflow exports are present', () => {
  assert.deepEqual(files, ['01-ticket-intake.json','02-sla-monitor.json','03-ticket-lifecycle.json','04-error-handler.json']);
  assert.deepEqual(workflows.map(w => w.nodes.length), [14,9,9,5]);
});

for (let i = 0; i < workflows.length; i++) {
  const w = workflows[i];
  test(`${files[i]}: inactive and stripped of deployment metadata`, () => {
    assert.equal(w.active, false);
    assert.deepEqual(w.pinData, {});
    for (const key of ['id','versionId','meta','tags','nodeGroups']) assert.equal(Object.hasOwn(w,key), false);
    assert.equal(Object.hasOwn(w.settings,'errorWorkflow'), false);
    for (const node of w.nodes) {
      assert.equal(Object.hasOwn(node,'credentials'),false);
      assert.equal(Object.hasOwn(node,'webhookId'),false);
    }
  });
  test(`${files[i]}: graph and expression references resolve`, () => {
    const names = new Set(w.nodes.map(n => n.name));
    assert.equal(names.size,w.nodes.length);
    for (const [source,outputs] of Object.entries(w.connections)) {
      assert(names.has(source));
      for (const branches of Object.values(outputs)) for (const branch of branches) for (const edge of branch) {
        assert(names.has(edge.node), `Unknown target: ${edge.node}`);
        assert(Number.isInteger(edge.index) && edge.index >= 0);
      }
    }
    for (const node of w.nodes) {
      const refs = [...JSON.stringify(node.parameters).matchAll(/\$\('([^']+)'\)/g)];
      for (const [,name] of refs) assert(names.has(name), `Unknown expression reference: ${name}`);
    }
  });
  test(`${files[i]}: resource locators are sanitized`, () => {
    for (const n of w.nodes) {
      const p = n.parameters;
      if (n.type.endsWith('.googleSheets')) {
        assert.deepEqual(p.documentId,{__rl:true,mode:'id',value:'REPLACE_WITH_SPREADSHEET_ID'});
        assert.deepEqual(p.sheetName,{__rl:true,mode:'name',value:i === 3 ? 'Error Log' : 'Tickets'});
      }
      if (n.type.endsWith('.slack')) assert.match(p.channelId.value,/^REPLACE_WITH_(SUPPORT|ALERTS)_CHANNEL_ID$/);
    }
    const raw = JSON.stringify(w);
    assert(!/docs\.google\.com\/spreadsheets\/d\//.test(raw));
    assert(!/\b[CUWGT][A-Z0-9]{8,}\b/.test(raw));
    assert(!/(?:sk-(?:proj-)?[A-Za-z0-9_-]{15,}|xox[baprs]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9_]+|-----BEGIN .*PRIVATE KEY-----)/.test(raw));
    for (const email of raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) assert(email.endsWith('@example.com'));
  });
  test(`${files[i]}: Code-node JavaScript parses`, () => {
    for (const n of w.nodes.filter(n => n.type.endsWith('.code'))) new vm.Script(`(function(){\n${n.parameters.jsCode}\n})()`);
  });
}

test('structured parser retains classification enums and required fields', () => {
  const schema = JSON.parse(intake.nodes.find(n => n.type.endsWith('.outputParserStructured')).parameters.inputSchema);
  assert.deepEqual(schema.properties.category.enum,['student_support','academic','sales','billing','spam']);
  assert.deepEqual(schema.properties.priority.enum,['P1','P2','P3','P4']);
  assert.deepEqual(schema.properties.sla_minutes.enum,[30,120,1440,2880]);
  assert.equal(schema.additionalProperties,false);
  assert.deepEqual(schema.required,['category','priority','owner','sla_minutes','reasoning','summary','customer_sentiment']);
});

test('synthetic classification example agrees with field constraints', () => {
  const example = JSON.parse(fs.readFileSync(path.join(root,'examples/classifier-output.json'),'utf8'));
  const schema = JSON.parse(intake.nodes.find(n => n.type.endsWith('.outputParserStructured')).parameters.inputSchema);
  for (const key of schema.required) assert(Object.hasOwn(example,key));
  for (const [key,definition] of Object.entries(schema.properties)) {
    if (definition.enum) assert(definition.enum.includes(example[key]));
    if (definition.minLength) assert(example[key].length >= definition.minLength);
  }
});

test('example spreadsheet headers match the actual writer mappings', () => {
  const headers = name => fs.readFileSync(path.join(root,'examples',name),'utf8').trim().split(',');
  assert.deepEqual(headers('tickets-header.csv'),Object.keys(nodesOf(intake).get('Запис робочого тікета').parameters.columns.value));
  assert.deepEqual(headers('error-log-header.csv'),Object.keys(nodesOf(errorHandler).get('Запис помилки до журналу').parameters.columns.value));
});

test('lifecycle header authentication and HTTP response branches remain enabled', () => {
  const webhook = lifecycle.nodes.find(n => n.type.endsWith('.webhook'));
  assert.equal(webhook.parameters.authentication,'headerAuth');
  assert.equal(webhook.parameters.httpMethod,'POST');
  assert.equal(webhook.parameters.responseMode,'responseNode');
  assert.equal(nodesOf(lifecycle).get('Відповідь 200 — успішно').parameters.options.responseCode,200);
  assert.equal(nodesOf(lifecycle).get('Відповідь 404 — тікет не знайдено').parameters.options.responseCode,404);
});

// These mocks test selected control-flow rules, NOT Luxon/timezone semantics or n8n integrations.
const now = '2026-06-01T12:00:00.000+02:00';
const mockDateTime = {
  now: () => ({ setZone: () => ({ toISO: () => now, diff: deadline => ({ minutes: (Date.parse(now)-Date.parse(deadline.iso))/60000 }) }) }),
  fromISO: iso => ({ iso, isValid: Number.isFinite(Date.parse(iso)) }),
};
function run(source,context) {
  const result = new vm.Script(`(function(){\n${source}\n})()`).runInNewContext({DateTime:mockDateTime,...context},{timeout:1000});
  return result === undefined ? result : JSON.parse(JSON.stringify(result));
}

const validate = event => run(code(lifecycle,'Перевірка події життєвого циклу'),{$json:event});
for (const status of ['in_progress','closed']) test(`lifecycle accepts ${status}`, () => {
  assert.equal(validate({body:{ticket_id:'synthetic-001',status}}).json.status,status);
});
test('lifecycle rejects missing ticket_id', () => assert.throws(() => validate({status:'closed'}),/ticket_id is required/));
for (const status of ['open','filtered','unknown']) test(`lifecycle rejects event status ${status}`, () => {
  assert.throws(() => validate({ticket_id:'synthetic-001',status}),/status must be/);
});
const prepare = (current,event) => run(code(lifecycle,'Підготовка оновлення статусу'),{$json:current,$:() => ({item:{json:event}})}).json;
test('lifecycle preserves an existing first-response timestamp', () => {
  const first = '2026-06-01T10:00:00+02:00';
  const result = prepare({status:'open',owner:'sales_lead',first_response_at:first},{ticket_id:'synthetic-001',status:'in_progress',owner:''});
  assert.equal(result.owner,'sales_lead'); assert.equal(result.first_response_at,first); assert.equal(result.resolved_at,'');
});
test('direct closure fills missing first-response and resolution timestamps', () => {
  const result = prepare({status:'open',owner:'sales_lead'},{ticket_id:'synthetic-001',status:'closed'});
  assert.equal(result.first_response_at,now); assert.equal(result.resolved_at,now);
});
test('closed ticket cannot be reopened', () => {
  assert.throws(() => prepare({status:'closed'},{ticket_id:'synthetic-001',status:'in_progress'}),/cannot be reopened/);
});
test('repeated closure preserves stored timestamps if no replacement is supplied', () => {
  const result = prepare({status:'closed',first_response_at:'first',resolved_at:'resolved'},{ticket_id:'synthetic-001',status:'closed'});
  assert.equal(result.first_response_at,'first'); assert.equal(result.resolved_at,'resolved');
});

const overdueRow = (minutes,extra = {}) => ({ticket_id:'synthetic-001',status:'open',sla_deadline:new Date(Date.parse(now)-minutes*60000).toISOString(),last_escalation_level:-1,...extra});
const escalate = rows => run(code(sla,'Розрахунок рівня ескалації'),{$input:{all:() => rows.map(json => ({json}))}});
for (const [minutes,expected] of [[-1,null],[0,0],[29,0],[30,1],[59,1],[60,2],[65,2]]) test(`SLA target at ${minutes} overdue minutes`, () => {
  const result = escalate([overdueRow(minutes)]);
  if (expected === null) assert.equal(result.length,0);
  else { assert.equal(result.length,1); assert.equal(result[0].json.escalation_level,expected); }
});
test('SLA does not repeat a persisted level or send a lower level', () => {
  assert.equal(escalate([overdueRow(40,{last_escalation_level:1}),overdueRow(5,{last_escalation_level:2})]).length,0);
});
test('SLA advances when the overdue threshold increases', () => {
  assert.equal(escalate([overdueRow(65,{last_escalation_level:0})])[0].json.escalation_level,2);
});
test('SLA accepts an empty previous level as not yet notified', () => {
  assert.equal(escalate([overdueRow(0,{last_escalation_level:''})])[0].json.escalation_level,0);
});
test('SLA skips missing/invalid deadlines and non-open tickets', () => {
  assert.equal(escalate([{status:'open'},overdueRow(10,{sla_deadline:'invalid'}),overdueRow(10,{status:'in_progress'}),overdueRow(10,{status:'closed'})]).length,0);
});
test('SLA code emits correct independent decisions for a batch', () => {
  const results = escalate([overdueRow(5,{ticket_id:'A'}),overdueRow(35,{ticket_id:'B'}),overdueRow(65,{ticket_id:'C'})]);
  assert.deepEqual(results.map(x => [x.json.ticket_id,x.json.escalation_level]),[['A',0],['B',1],['C',2]]);
});

test('Error Handler normalizes execution failure context', () => {
  const result = run(code(errorHandler,'Нормалізація контексту помилки'),{$json:{workflow:{id:'demo-workflow',name:'Synthetic flow'},execution:{id:'demo-execution',lastNodeExecuted:'Synthetic node',url:'https://example.com/execution',error:{message:'Synthetic failure',stack:'Synthetic stack'}}}}).json;
  assert.equal(result.error_id,'demo-execution'); assert.equal(result.error_message,'Synthetic failure'); assert.equal(result.workflow_name,'Synthetic flow'); assert.equal(result.status,'new');
});
test('Error Handler handles absent execution metadata', () => {
  const result = run(code(errorHandler,'Нормалізація контексту помилки'),{$json:{message:'Synthetic fallback'}}).json;
  assert.equal(result.workflow_name,'Unknown workflow'); assert.equal(result.error_message,'Synthetic fallback'); assert.equal(result.execution_url,''); assert.match(result.error_id,/^manual-/);
});
