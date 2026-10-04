# WebMCP Behavioral Eval Summary

45 runs; 45 rubric passes; 0 infra errors. Efficiency stats exclude failed-rubric and infra-error runs.

## Task: extract

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 54,784 (IQR 35,171-54,953) | 5 (IQR 5-5) | 28,071 ms (IQR 22,121-32,990 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 24,864 (IQR 24,861-24,874) | 6 (IQR 6-6) | 6,871 ms (IQR 6,722-7,163 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 80,721 (IQR 65,326-80,819) | 6 (IQR 5-6) | 10,567 ms (IQR 9,759-10,920 ms) |

## Task: traverse

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 24,430 (IQR 24,421-24,436) | 3 (IQR 3-3) | 18,090 ms (IQR 16,728-18,464 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 11,654 (IQR 11,654-17,494) | 2 (IQR 2-2) | 4,400 ms (IQR 3,541-4,419 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 31,827 (IQR 31,825-31,830) | 3 (IQR 3-3) | 5,280 ms (IQR 5,115-5,431 ms) |

## Task: discover

| Model | Pass rate | Tokens (total) | Tool calls | Wall clock |
| --- | --- | --- | --- | --- |
| zai/glm-5.3-flash | 5/5 | 11,594 (IQR 11,594-11,594) | 1 (IQR 1-1) | 9,434 ms (IQR 9,285-9,508 ms) |
| openrouter/openai/gpt-6-luna | 5/5 | 11,141 (IQR 11,141-11,149) | 1 (IQR 1-1) | 3,710 ms (IQR 3,275-3,798 ms) |
| anthropic/claude-haiku-4-5 | 5/5 | 14,068 (IQR 14,068-14,068) | 1 (IQR 1-1) | 2,481 ms (IQR 2,149-3,022 ms) |

