# WebMCP Behavioral Eval Summary (docs/audit/ai-performance/2026-10-04-webmcp-eval/delta-rerun)

45 runs; 45 rubric passes; 0 infra errors. Efficiency stats exclude failed-rubric and infra-error runs.

## Task: extract

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 48,710 (IQR 35,375-55,111) | 5 (IQR 5-6) | 25,055 ms (IQR 21,488-29,273 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 25,037 (IQR 25,031-34,779) | 6 (IQR 6-6) | 7,596 ms (IQR 7,409-9,207 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 81,244 (IQR 65,892-81,377) | 6 (IQR 5-6) | 10,939 ms (IQR 9,772-11,170 ms) |

## Task: traverse

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 18,027 (IQR 18,027-18,027) | 2 (IQR 2-2) | 13,480 ms (IQR 13,277-13,563 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 17,659 (IQR 17,659-17,659) | 2 (IQR 2-2) | 4,870 ms (IQR 4,746-5,168 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 22,178 (IQR 22,169-22,657) | 2 (IQR 2-2) | 3,092 ms (IQR 2,962-3,769 ms) |

## Task: discover

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 11,704 (IQR 11,704-11,704) | 1 (IQR 1-1) | 9,437 ms (IQR 9,153-9,462 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 11,259 (IQR 11,259-11,259) | 1 (IQR 1-1) | 3,452 ms (IQR 3,452-4,165 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 14,185 (IQR 14,185-14,185) | 1 (IQR 1-1) | 1,819 ms (IQR 1,736-1,852 ms) |

