CONTINUE — automatic resume by the pipeline orchestrator.

Your previous run of step {{STEP_ID}} ({{STEP_TITLE}}) was interrupted: {{REASON}}.

1. Re-orient first: run `git status --short` and `git log --oneline -8`, re-read docs/PROGRESS.md and your step checklist docs/progress/{{STEP_ID}}.md if it exists.
2. Continue the SAME task from where it stopped. Do not redo finished work and do not revert work from other steps.
3. When everything in the step's Definition of Done is complete, run the step's verification and end with the required "## Step report".
4. If this is a planning step (plan mode), finish the research and then output the COMPLETE plan as your final message, followed by the Step report — the orchestrator saves your final message as the plan.
