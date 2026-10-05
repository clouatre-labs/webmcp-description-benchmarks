# Composite scores and statistical comparison (rerun vs baseline)

n = 5 per cell (baseline vs delta-rerun). Each metric per cell is tested with an exact two-sided Mann-Whitney U test (permutation over all C(10,5) = 252 assignments, midranks for ties) at alpha = 0.05. Effect size is the rank-biserial r; the median-difference 95% CI is a percentile bootstrap with 10,000 resamples (seed 42). No correction for the nine parallel tests per metric is applied; results are exploratory. Composite score is the fraction of true rubric checks per run; runs with detail 'not run' are excluded. Token medians here include all 45 runs per batch, including the one baseline rubric FAIL, so they can differ from the pass-only medians in the batch summary.md files.

## Composite score per cell

| Task | Model | Baseline median | Rerun median | U | p | r | Median diff 95% CI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| discover | anthropic/claude-haiku-4-5 | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |
| discover | openrouter/openai/gpt-6-luna | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |
| discover | zai/glm-5.3-flash | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |
| extract | anthropic/claude-haiku-4-5 | 1.000 | 1.000 | 10 | 1.000 | 0.200 | [0.000, 0.500] |
| extract | openrouter/openai/gpt-6-luna | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |
| extract | zai/glm-5.3-flash | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |
| traverse | anthropic/claude-haiku-4-5 | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |
| traverse | openrouter/openai/gpt-6-luna | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |
| traverse | zai/glm-5.3-flash | 1.000 | 1.000 | 12.5 | 1.000 | 0.000 | [0.000, 0.000] |

## Tokens per cell

| Task | Model | Baseline median | Rerun median | U | p | r | Median diff 95% CI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| discover | anthropic/claude-haiku-4-5 | 14264.000 | 14185.000 | 25 | 0.008 | -1.000 | [-83.000, -45.000] |
| discover | openrouter/openai/gpt-6-luna | 11139.000 | 11259.000 | 0 | 0.008 | 1.000 | [53.000, 192.000] |
| discover | zai/glm-5.3-flash | 11755.000 | 11704.000 | 21 | 0.040 | -0.680 | [-54.000, 1.000] |
| extract | anthropic/claude-haiku-4-5 | 64695.000 | 81244.000 | 2 | 0.032 | 0.840 | [952.000, 49111.000] |
| extract | openrouter/openai/gpt-6-luna | 24381.000 | 25037.000 | 4 | 0.095 | 0.680 | [-14920.000, 16685.000] |
| extract | zai/glm-5.3-flash | 54121.000 | 48710.000 | 12 | 1.000 | 0.040 | [-18872.000, 20384.000] |
| traverse | anthropic/claude-haiku-4-5 | 22268.000 | 22178.000 | 15 | 0.619 | -0.200 | [-138.000, 399.000] |
| traverse | openrouter/openai/gpt-6-luna | 16999.000 | 17659.000 | 5 | 0.048 | 0.600 | [-5489.000, 671.000] |
| traverse | zai/glm-5.3-flash | 18017.000 | 18027.000 | 0 | 0.008 | 1.000 | [10.000, 10.000] |

## Rubric pass counts per cell

| Task | Model | Baseline | Rerun |
| --- | --- | --- | --- |
| discover | anthropic/claude-haiku-4-5 | 5/5 | 5/5 |
| discover | openrouter/openai/gpt-6-luna | 5/5 | 5/5 |
| discover | zai/glm-5.3-flash | 5/5 | 5/5 |
| extract | anthropic/claude-haiku-4-5 | 4/5 | 5/5 |
| extract | openrouter/openai/gpt-6-luna | 5/5 | 5/5 |
| extract | zai/glm-5.3-flash | 5/5 | 5/5 |
| traverse | anthropic/claude-haiku-4-5 | 5/5 | 5/5 |
| traverse | openrouter/openai/gpt-6-luna | 5/5 | 5/5 |
| traverse | zai/glm-5.3-flash | 5/5 | 5/5 |


Significant cells (alpha = 0.05):
- tokens discover | anthropic/claude-haiku-4-5: rerun lower than baseline (p = 0.008)
- tokens discover | openrouter/openai/gpt-6-luna: rerun higher than baseline (p = 0.008)
- tokens discover | zai/glm-5.3-flash: rerun lower than baseline (p = 0.040)
- tokens extract | anthropic/claude-haiku-4-5: rerun higher than baseline (p = 0.032)
- tokens traverse | openrouter/openai/gpt-6-luna: rerun higher than baseline (p = 0.048)
- tokens traverse | zai/glm-5.3-flash: rerun higher than baseline (p = 0.008)
