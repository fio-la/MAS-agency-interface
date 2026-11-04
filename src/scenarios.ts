import type { Scenario } from './types';

// Simulated multi-agent workflows. Each scenario is a DAG of steps carried out by
// specialised agents, with one planted mistake (to exercise critical evaluation),
// one side-effecting action (to exercise previews) and key checkpoints.
// Domains are taken from participants' application contexts (Sec. 4.2).

const C = {
  orch: '#6366f1',
  data: '#0ea5e9',
  clean: '#14b8a6',
  stats: '#f59e0b',
  viz: '#ec4899',
  write: '#8b5cf6',
  review: '#ef4444',
  ops: '#22c55e',
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'vaccination',
    title: 'Regional vaccination rates',
    domain: 'Medical research',
    prompt:
      'Determine whether childhood vaccination rates differ between regions in 2023, and publish a short brief for the public-health team.',
    starterPrompts: [
      'Determine whether childhood vaccination rates differ between regions in 2023, and publish a short brief for the public-health team.',
      'Compare measles (MMR) coverage across regions and flag regions below the 95% herd-immunity target.',
      'Summarise trends in regional vaccination coverage from 2019 to 2023.',
    ],
    clarifications: [
      { id: 'level', question: 'At which geographic level should regions be compared?', options: ['Federal states', 'Districts', 'Urban vs. rural'] },
      { id: 'audience', question: 'Who is the brief for?', options: ['Epidemiologists', 'Policy makers', 'General public'] },
    ],
    agents: [
      { id: 'orch', name: 'Orchestrator', role: 'Plans and routes work', expertise: 'Task decomposition, delegation', color: C.orch, initials: 'OR', model: 'large' },
      { id: 'data', name: 'Data Retriever', role: 'Fetches registry data', expertise: 'Public-health registries, census APIs', color: C.data, initials: 'DR', model: 'large' },
      { id: 'clean', name: 'Data Cleaner', role: 'Harmonises datasets', expertise: 'Data validation, joins, missing values', color: C.clean, initials: 'DC', model: 'small' },
      { id: 'stats', name: 'Statistician', role: 'Runs the analysis', expertise: 'Hypothesis testing, regression', color: C.stats, initials: 'ST', model: 'large' },
      { id: 'viz', name: 'Visualiser', role: 'Builds charts', expertise: 'Choropleth maps, charts', color: C.viz, initials: 'VI', model: 'small' },
      { id: 'write', name: 'Report Writer', role: 'Drafts the brief', expertise: 'Science communication', color: C.write, initials: 'RW', model: 'large' },
      { id: 'review', name: 'Reviewer', role: 'Critiques the draft', expertise: 'Methodology review', color: C.review, initials: 'RV', model: 'large' },
    ],
    steps: [
      {
        id: 'plan', agentId: 'orch', title: 'Plan the analysis', dependsOn: [], duration: 3, tokens: 1800, confidence: 0.92, checkpoint: true,
        input: 'User task + clarification answers.',
        rationale: 'Split into retrieval → cleaning → statistics → visualisation → writing → review so each agent works within its specialisation.',
        output: 'Plan: (1) pull 2023 vaccination counts per region, (2) join with population denominators, (3) compute coverage and test regional differences, (4) map coverage, (5) draft brief, (6) review, (7) publish.',
        messages: [{ to: 'data', text: 'Fetch 2023 childhood vaccination counts per region and matching population denominators.' }],
      },
      {
        id: 'fetch', agentId: 'data', title: 'Retrieve registry data', dependsOn: ['plan'], duration: 5, tokens: 4200, confidence: 0.64,
        input: 'Request from Orchestrator: 2023 counts + population denominators.',
        rationale: 'Used the national immunisation registry for counts. The census endpoint for 2023 timed out, so the most recent cached release was used.',
        output: 'Retrieved 16 regional count tables (2023) and population denominators {{flaw}}.',
        flaw: {
          text: 'from the 2019 census release (2023 endpoint unavailable)',
          fixed: 'from the 2023 census release (retried after timeout)',
          note: 'Denominators are from 2019, not 2023: coverage for fast-growing regions is overstated.',
        },
        messages: [{ to: 'clean', text: 'Here are 16 count tables and population denominators. Note: census fallback was used.' }],
      },
      {
        id: 'clean', agentId: 'clean', title: 'Clean & join datasets', dependsOn: ['fetch'], duration: 4, tokens: 3000, confidence: 0.86,
        input: 'Count tables + denominators from Data Retriever.',
        rationale: 'Harmonised region codes, removed 3 duplicate rows, imputed 2 missing district totals from neighbouring months.',
        output: 'Joined table: 16 regions × 4 vaccines, 0 unmatched codes, 2 imputed values flagged.',
        messages: [{ to: 'stats', text: 'Clean table ready. 2 imputed values are flagged in column `imputed`.' }],
      },
      {
        id: 'stats', agentId: 'stats', title: 'Test regional differences', dependsOn: ['clean'], duration: 6, tokens: 6500, confidence: 0.81, checkpoint: true,
        input: 'Clean joined table from Data Cleaner.',
        rationale: 'Chi-squared test across regions, then pairwise comparisons with Holm correction; logistic regression with urbanicity as covariate.',
        output: 'Coverage differs significantly between regions (χ²(15) = 412.7, p < .001). Range 88.4%–97.1%. 5 of 16 regions fall below the 95% MMR target; urbanicity explains part of the gap (OR = 0.82).',
        messages: [
          { to: 'viz', text: 'Coverage per region attached; highlight the 5 regions under 95%.' },
          { to: 'write', text: 'Key result: significant regional differences, 5 regions below target.' },
        ],
      },
      {
        id: 'viz', agentId: 'viz', title: 'Map coverage', dependsOn: ['stats'], duration: 4, tokens: 2600, confidence: 0.9,
        input: 'Per-region coverage from Statistician.',
        rationale: 'A choropleth with a diverging scale centred on the 95% target makes under-target regions stand out.',
        output: 'Choropleth map + bar chart of MMR coverage per region, target line at 95%.',
        messages: [{ to: 'write', text: 'Figures ready: map (fig 1) and bar chart (fig 2).' }],
      },
      {
        id: 'draft', agentId: 'write', title: 'Draft the brief', dependsOn: ['stats', 'viz'], duration: 5, tokens: 5200, confidence: 0.84,
        input: 'Statistical results + figures.',
        rationale: 'Lead with the actionable finding (regions below target), then method and caveats, in plain language for the chosen audience.',
        output: 'Draft brief (1 page): headline finding, map, list of 5 under-target regions, method note, limitations.',
        messages: [{ to: 'review', text: 'Draft ready for review.' }],
      },
      {
        id: 'review', agentId: 'review', title: 'Review methodology', dependsOn: ['draft'], duration: 4, tokens: 3400, confidence: 0.78, checkpoint: true,
        input: 'Draft brief + analysis trail.',
        rationale: 'Checked claims against the analysis, checked figure labelling, and looked for overstated causal language.',
        output: 'Approved with edits: softened causal wording about urbanicity; added a note on imputed values.',
        messages: [{ to: 'orch', text: 'Brief is ready to publish.' }],
      },
      {
        id: 'publish', agentId: 'orch', title: 'Publish brief', dependsOn: ['review'], duration: 2, tokens: 600, confidence: 0.95,
        input: 'Reviewed brief.',
        rationale: 'Final step requested in the task.',
        output: 'Brief published to the public-health team’s shared drive and team notified.',
        sideEffect: {
          label: 'Publish to shared drive & notify 14 team members',
          preview: 'Will upload “Regional vaccination brief 2023.pdf” to /public-health/briefs and send a notification to 14 team members. This cannot be silently undone.',
        },
      },
    ],
    summary:
      'Childhood vaccination coverage differed significantly between regions in 2023 (88.4%–97.1%). Five of sixteen regions fall below the 95% MMR target. A one-page brief with a map and method notes was prepared for the public-health team.',
  },
  {
    id: 'finance',
    title: 'Quarterly variance report',
    domain: 'Finance',
    prompt:
      'Prepare the Q3 budget-vs-actual variance report for the EMEA unit, explain variances over 5%, and book the required accrual adjustment.',
    starterPrompts: [
      'Prepare the Q3 budget-vs-actual variance report for the EMEA unit, explain variances over 5%, and book the required accrual adjustment.',
      'Reconcile Q3 travel expenses against approved budgets and flag anomalies.',
      'Forecast Q4 operating costs from the Q1–Q3 actuals.',
    ],
    clarifications: [
      { id: 'currency', question: 'Report currency?', options: ['EUR', 'USD', 'GBP'] },
      { id: 'threshold', question: 'Which variances need an explanation?', options: ['Over 5%', 'Over 10%', 'Over €50k'] },
    ],
    agents: [
      { id: 'orch', name: 'Orchestrator', role: 'Plans and routes work', expertise: 'Task decomposition', color: C.orch, initials: 'OR', model: 'large' },
      { id: 'data', name: 'Ledger Agent', role: 'Pulls GL data', expertise: 'ERP exports, general ledger', color: C.data, initials: 'LA', model: 'small' },
      { id: 'clean', name: 'FX Agent', role: 'Currency conversion', expertise: 'FX rates, consolidation', color: C.clean, initials: 'FX', model: 'small' },
      { id: 'stats', name: 'Analyst', role: 'Variance analysis', expertise: 'Budget-vs-actual, drivers', color: C.stats, initials: 'AN', model: 'large' },
      { id: 'write', name: 'Report Writer', role: 'Writes commentary', expertise: 'Management reporting', color: C.write, initials: 'RW', model: 'large' },
      { id: 'ops', name: 'Booking Agent', role: 'Posts journal entries', expertise: 'Accruals, ERP posting', color: C.ops, initials: 'BK', model: 'large' },
    ],
    steps: [
      {
        id: 'plan', agentId: 'orch', title: 'Plan the report', dependsOn: [], duration: 3, tokens: 1500, confidence: 0.93, checkpoint: true,
        input: 'User task + clarification answers.', rationale: 'Pull ledger and budget in parallel, convert currency, then analyse, write and book.',
        output: 'Plan: pull Q3 actuals and budget, consolidate currencies, compute variances, explain variances over threshold, book accrual.',
        messages: [{ to: 'data', text: 'Export Q3 GL actuals and budget lines for EMEA.' }],
      },
      {
        id: 'actuals', agentId: 'data', title: 'Export actuals', dependsOn: ['plan'], duration: 4, tokens: 2800, confidence: 0.9,
        input: 'ERP export request.', rationale: 'Exported posted entries only; excluded parked documents.',
        output: '12,418 posted GL lines for Q3 across 9 cost centres in 3 currencies.',
        messages: [{ to: 'clean', text: 'Actuals in EUR, GBP and CHF attached.' }],
      },
      {
        id: 'budget', agentId: 'data', title: 'Export budget', dependsOn: ['plan'], duration: 3, tokens: 1600, confidence: 0.92,
        input: 'Budget request.', rationale: 'Used the approved budget version (v3), not the draft (v4).',
        output: 'Approved Q3 budget v3: 9 cost centres, €8.42m total.',
        messages: [{ to: 'stats', text: 'Budget v3 attached.' }],
      },
      {
        id: 'fx', agentId: 'clean', title: 'Convert currencies', dependsOn: ['actuals'], duration: 3, tokens: 1900, confidence: 0.62,
        input: 'Actuals in three currencies.', rationale: 'Converted all lines into the reporting currency using a single rate table.',
        output: 'Consolidated actuals: €8.97m, {{flaw}}.',
        flaw: {
          text: 'converted at spot rates from the report date',
          fixed: 'converted at Q3 average rates per group policy',
          note: 'Spot rates were used instead of the Q3 average rates required by group policy; GBP lines are overstated by ~€61k.',
        },
        messages: [{ to: 'stats', text: 'Consolidated actuals ready.' }],
      },
      {
        id: 'variance', agentId: 'stats', title: 'Compute variances', dependsOn: ['fx', 'budget'], duration: 5, tokens: 4800, confidence: 0.83, checkpoint: true,
        input: 'Consolidated actuals + budget v3.', rationale: 'Variance by cost centre and account group; flagged lines over threshold and traced drivers.',
        output: 'Total variance +6.5% (€550k over budget). Over threshold: Travel (+18%), Contractors (+11%), Software licences (+7%). Unbooked October contractor invoices require a €4,200 accrual.',
        messages: [
          { to: 'write', text: 'Three variances over threshold; drivers attached.' },
          { to: 'ops', text: 'Accrual of €4,200 required for unbooked contractor invoices.' },
        ],
      },
      {
        id: 'commentary', agentId: 'write', title: 'Write commentary', dependsOn: ['variance'], duration: 4, tokens: 3900, confidence: 0.86,
        input: 'Variance table + drivers.', rationale: 'Management-style commentary: what, why, and what happens next for each variance.',
        output: 'Commentary for 3 variances: travel driven by two customer summits; contractors by delayed hiring; licences by an early renewal.',
      },
      {
        id: 'book', agentId: 'ops', title: 'Book accrual', dependsOn: ['variance'], duration: 2, tokens: 700, confidence: 0.9,
        input: 'Accrual instruction from Analyst.', rationale: 'Accrual required so Q3 cost reflects services received.',
        output: 'Journal entry JE-2291 posted: €4,200 accrued contractor cost, auto-reversing 1 Oct.',
        sideEffect: {
          label: 'Post €4,200 journal entry to the ledger',
          preview: 'Debit 6420 Contractor cost €4,200 / Credit 2900 Accrued liabilities €4,200, cost centre EMEA-OPS, auto-reversal on 1 Oct.',
        },
      },
    ],
    summary:
      'EMEA was €550k (+6.5%) over the Q3 budget. Travel, contractors and software licences exceeded the threshold, each with an explained driver. A €4,200 accrual for unbooked contractor invoices was prepared.',
  },
  {
    id: 'webapp',
    title: 'Build an MVP web app',
    domain: 'Software engineering',
    prompt: 'Build an MVP of a team task board with login, task lists and due-date reminders, and deploy it to staging.',
    starterPrompts: [
      'Build an MVP of a team task board with login, task lists and due-date reminders, and deploy it to staging.',
      'Add CSV export to the existing task board.',
      'Write end-to-end tests for the login flow.',
    ],
    clarifications: [
      { id: 'stack', question: 'Preferred stack?', options: ['React + Node', 'Next.js', 'Django'] },
      { id: 'auth', question: 'How should users log in?', options: ['Email + password', 'Company SSO', 'Magic link'] },
    ],
    agents: [
      { id: 'orch', name: 'Orchestrator', role: 'Plans and routes work', expertise: 'Architecture, decomposition', color: C.orch, initials: 'OR', model: 'large' },
      { id: 'data', name: 'Backend Dev', role: 'API & database', expertise: 'REST APIs, SQL', color: C.data, initials: 'BE', model: 'large' },
      { id: 'viz', name: 'Frontend Dev', role: 'User interface', expertise: 'React, accessibility', color: C.viz, initials: 'FE', model: 'large' },
      { id: 'review', name: 'Tester', role: 'Writes and runs tests', expertise: 'Unit & e2e testing', color: C.review, initials: 'QA', model: 'small' },
      { id: 'ops', name: 'DevOps', role: 'Builds and deploys', expertise: 'CI/CD, containers', color: C.ops, initials: 'DO', model: 'small' },
    ],
    steps: [
      {
        id: 'plan', agentId: 'orch', title: 'Design architecture', dependsOn: [], duration: 3, tokens: 2200, confidence: 0.9, checkpoint: true,
        input: 'User task + clarification answers.', rationale: 'Separate backend and frontend so they can be built in parallel against an agreed API contract.',
        output: 'Architecture: REST API (users, boards, tasks, reminders), SQL schema with 4 tables, SPA frontend, nightly reminder job.',
        messages: [
          { to: 'data', text: 'Implement API per contract v1.' },
          { to: 'viz', text: 'Build UI against API contract v1.' },
        ],
      },
      {
        id: 'api', agentId: 'data', title: 'Implement API', dependsOn: ['plan'], duration: 6, tokens: 7800, confidence: 0.66, checkpoint: true,
        input: 'API contract v1.', rationale: 'Implemented CRUD endpoints with input validation; reused the session middleware for auth.',
        output: 'API: 14 endpoints, migrations for 4 tables, {{flaw}}.',
        flaw: {
          text: 'task endpoints check login but not board membership',
          fixed: 'every task endpoint checks board membership',
          note: 'Authorisation gap: any logged-in user can read and edit tasks on boards they are not a member of.',
        },
        messages: [{ to: 'review', text: 'API ready for testing.' }],
      },
      {
        id: 'ui', agentId: 'viz', title: 'Build interface', dependsOn: ['plan'], duration: 6, tokens: 7200, confidence: 0.85,
        input: 'API contract v1.', rationale: 'Board view with drag-and-drop columns; keyboard-accessible alternatives for reordering.',
        output: 'UI: login, board list, board view with 3 columns, task dialog with due date, reminder settings.',
        messages: [{ to: 'review', text: 'UI ready for e2e tests.' }],
      },
      {
        id: 'tests', agentId: 'review', title: 'Test the app', dependsOn: ['api', 'ui'], duration: 5, tokens: 4600, confidence: 0.8,
        input: 'API + UI builds.', rationale: 'Unit tests for endpoints, e2e tests for the main flows (login, create task, set reminder).',
        output: '61 unit tests and 9 e2e tests passing; coverage 78%.',
        messages: [{ to: 'ops', text: 'All tests green, ready to deploy.' }],
      },
      {
        id: 'deploy', agentId: 'ops', title: 'Deploy to staging', dependsOn: ['tests'], duration: 3, tokens: 1400, confidence: 0.88,
        input: 'Green build.', rationale: 'Requested in the task; staging is isolated from production data.',
        output: 'Deployed build #42 to staging; health checks passing.',
        sideEffect: {
          label: 'Deploy build #42 to staging',
          preview: 'Will build a container image, run 4 database migrations on the staging database and replace the running staging release.',
        },
      },
    ],
    summary:
      'An MVP task board with login, boards, tasks and due-date reminders was designed, implemented, tested (61 unit, 9 e2e tests) and deployed to staging.',
  },
];

export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
