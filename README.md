# MAS-agency-interface

A personalizable interface for multi-agent AI systems (MAS). Each user configures which agency-support features they want. It implements the design implications of *Rethinking Human Agency in Multi-Agent AI Systems: Investigating Current Practices and User Needs* (CHI '27 submission).

The paper's main finding is that agency needs (trust, control, ownership, critical evaluation) are **individually configured**: only two of 20 participants asked for the same set of design elements. The paper therefore argues for **layered, modular, configurable** agency support instead of a single fixed design. This app is the configurable MAS that the paper's *Future Work* section proposes, built so that researchers can vary individual design elements in a study.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## How it maps to the paper

**Delegation lifecycle (Sec. 2.2 / 5.1).** The top navigation follows the paper's four stages:

| Stage | Agency dimension | What you do |
| --- | --- | --- |
| 1 Delegate | Trust | Pick a task, use starter prompts, answer clarification questions, see the team and its track record |
| 2 Execute | Control | Watch and steer the agents: approve, send back, redirect, preview side effects, remove agents, switch models |
| 3 Evaluate | Critical evaluation | Summary, per-step confidence, input & reasoning, verifier, mark issues, edit, approve & release |
| 4 Own & reflect | Ownership | Contribution ledger, corrections memory, quiz, the paper's agency questionnaire (App. A.2), JSON export |

**Agency support modules (Table 2 / Fig. 3).** Open **⚙ Agency support** to configure them:

| Design element | Modules |
| --- | --- |
| D8 Workflow visibility (11/20) | Flowchart, activity timeline, audit trail, animation, inter-agent messages, input & reasoning, agent avatars, preview before side effects |
| D7 Human in the loop (8/20) | Approval checkpoints (final / checkpoints / every step), mid-run redirect, edit outputs, corrections memory (reused in later runs) |
| D6 Reliability safeguards (7/20) | Confidence scores, pause on low confidence, verification tool |
| D5 Software design approaches (7/20) | Stigmergic "trails": agents mark hand-offs as safe or risky, and downstream agents re-check risky inputs (P16) |
| D4 Guidance support (4/20) | Starter prompts, clarification questions |
| D3 Resource controls (4/20) | Token budget & cost meter, per-agent model choice, remove agents |
| D2 Gamification (1/20) | Quiz about the run |
| D1 Summaries (1/20) | Outcome summary |
| Literature | Contribution ledger (ownership) |

**Ways to configure:**

- **Presets:** Outcome only, Process insight, Hands-on, Resource-conscious, Everything.
- **Start from a study participant:** loads P1–P20's design-element set, transcribed from Fig. 3.
- **From your needs:** pick needs from Fig. 2 (control, understanding, transparency, …) and the app recommends modules.
- **Transparency as a spectrum (Sec. 5.5):** switch between *Outcome view* and *Process view* at any time.

## Architecture

- `src/engine.ts`: a pure reducer that simulates the MAS runtime. Agents run a DAG of steps. The human can approve, reject, redirect, edit, kill an agent, switch models, verify and preview, and every action is written to the audit log.
- `src/scenarios.ts`: three simulated workflows taken from participants' domains (medical research, finance, software). Each contains one planted mistake for critical evaluation, one side-effecting action for previews, and key checkpoints.
- `src/features.ts`: the feature catalog with the paper's evidence and quotes, the participant profiles, presets and the needs → features mapping.
- `src/components/`: one view per lifecycle stage, plus the configuration drawer.

The configuration, corrections and saved reflections are stored in `localStorage`.

## Notes

- The agents are **simulated**: outputs are scripted and deterministic, so study conditions can be reproduced. To use real LLM agents, replace the step outputs in `engine.ts` (`completeStep`) with model calls.
- Fig. 3 places D1 (Summaries) at P18 and D2 (Gamification) at P7. The paper's text attributes "summaries" to P7 and "a little quiz" to P18. The participant profiles follow the text.
