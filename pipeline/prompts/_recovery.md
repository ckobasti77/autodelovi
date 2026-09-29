RECOVERY — automatic recovery run by the pipeline orchestrator.

Step {{STEP_ID}} ({{STEP_TITLE}}) failed {{ATTEMPTS}} times. Last error, as reported by the orchestrator:

{{LAST_ERROR}}

The original step instructions are in {{PROMPT_FILE}} — read them fully first. Raw logs of the failed attempts are in pipeline/logs/{{STEP_ID}}-*.jsonl (large: search them, do not read them whole) and the step reports in pipeline/logs/{{STEP_ID}}-*-result.md if present.

1. Diagnose the root cause (environment, tooling, code or data).
2. Fix it.
3. Complete the original step's Definition of Done — build only what is still missing, keep what already works.
4. Verify with command output and end with the required "## Step report".

If the cause is outside your control (missing credentials, a service outage), implement the safest fallback, document it in docs/HUMAN-TODO.md, and finish everything else.
