# WebMCP Behavioral Eval Summary

45 runs; 44 rubric passes; 0 infra errors. Efficiency stats exclude failed-rubric and infra-error runs.

## Task: extract

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 54,121 (IQR 41,771-54,205) | 5 (IQR 5-5) | 23,899 ms (IQR 19,766-26,713 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 24,381 (IQR 24,374-24,393) | 6 (IQR 6-6) | 6,458 ms (IQR 5,981-6,750 ms) |
| anthropic/claude-haiku-4-5 | 4/5 | 64,676 (IQR 64,654-64,704) | 5 (IQR 5-5) | 8,751 ms (IQR 8,554-9,356 ms) |

Failed rubrics (excluded from stats above):

- claude-haiku-4-5 iter 1: claim quoted verbatim: false; used page traversal: true

## Task: traverse

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 18,017 (IQR 18,017-18,017) | 2 (IQR 2-2) | 11,055 ms (IQR 8,193-15,463 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 16,999 (IQR 16,999-16,999) | 2 (IQR 2-2) | 4,370 ms (IQR 4,334-5,126 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 22,268 (IQR 22,268-22,268) | 2 (IQR 2-2) | 3,328 ms (IQR 3,179-4,371 ms) |

## Task: discover

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 11,755 (IQR 11,755-11,755) | 1 (IQR 1-1) | 6,961 ms (IQR 6,889-7,268 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 11,139 (IQR 11,067-11,162) | 1 (IQR 1-1) | 6,045 ms (IQR 3,044-6,724 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 14,264 (IQR 14,264-14,264) | 1 (IQR 1-1) | 2,137 ms (IQR 1,994-2,209 ms) |

