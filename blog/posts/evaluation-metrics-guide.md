---
title: Evaluation metrics in ML, deep learning, LLMs and agents
date: 2026-11-20
tags: [machine-learning, deep-learning, llms, statistics]
related: [llm-preference]
summary: A reference guide to the metrics and statistical tests used across AI, from classification and regression to vision, speech, LLMs, RAG, agents and MCP tool use, with when to use each one.
---

A model is only as good as the way you measure it. Pick the wrong metric and a useless model can look excellent: 99% accuracy on a dataset where 99% of cases are negative, or a chatbot that tops a leaderboard because it writes longer answers.

This is my reference guide to evaluation across AI. For each area it lists the main metrics, what they measure, and when to use them. The second half covers the statistical tests that tell you whether a difference between two models is real.

**What's inside:**

- How to choose a metric
- Classification, regression, and linear vs non-linear models
- Ranking, clustering, time series and anomaly detection
- Computer vision, speech and audio, classic NLP
- LLMs, RAG, agents and MCP tool use
- Generative models, reinforcement learning, fairness, calibration and efficiency
- Statistical tests: which one to use when
- Common pitfalls, and a cheat sheet

## How to choose a metric

Four questions come before any formula:

1. **What decision will the model support?** A cancer screen cares about missed cases (recall). A spam filter cares about wrongly blocked mail (precision). The metric should reflect the cost of each kind of mistake.
2. **What is the baseline?** Always report a trivial baseline: the majority class, the mean value, yesterday's value for a forecast, or a simple linear model. A metric means little without one.
3. **Is the test data like real use?** A great score on a random split can collapse on new hospitals, new users or next month's data. The split often matters more than the metric.
4. **How uncertain is the number?** Every metric comes from a sample. Report a confidence interval, or at least the spread across seeds and folds.

> Use one **primary metric** you decided on before the experiment, plus a few **secondary metrics** that catch what the primary one hides.

## Classification

Everything starts from the **confusion matrix**:

| | Predicted positive | Predicted negative |
| --- | --- | --- |
| **Actually positive** | True positive (TP) | False negative (FN) |
| **Actually negative** | False positive (FP) | True negative (TN) |

### Threshold metrics

These judge hard yes/no predictions at one decision threshold.

| Metric | Formula | Use it when |
| --- | --- | --- |
| **Accuracy** | `(TP + TN) / all` | Classes are balanced and all errors cost the same |
| **Balanced accuracy** | Mean of the recall of each class | Classes are imbalanced; 0.5 means chance for two classes |
| **Precision** | `TP / (TP + FP)` | False alarms are expensive (spam filtering, fraud alerts that block a card) |
| **Recall** (sensitivity, TPR) | `TP / (TP + FN)` | Missed cases are expensive (disease screening, safety checks) |
| **Specificity** (TNR) | `TN / (TN + FP)` | Reported alongside sensitivity in medicine |
| **F1 score** | `2 · P · R / (P + R)` | You need one number that balances precision and recall |
| **F-beta** | Weights recall β times as much as precision | F2 when recall matters more, F0.5 when precision matters more |
| **MCC** (Matthews correlation) | `(TP·TN − FP·FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN))` | Imbalanced data; uses all four cells. Ranges −1 to 1, 0 is chance |
| **Cohen's kappa** | Agreement corrected for chance | Comparing against human labels, or agreement between annotators |

**Accuracy is the most misused metric in ML.** On imbalanced data, prefer balanced accuracy, MCC or F1, and always show the confusion matrix.

### Threshold-free metrics

These judge the model's scores or probabilities across all thresholds.

| Metric | What it measures | Use it when |
| --- | --- | --- |
| **ROC-AUC** | Chance a random positive scores higher than a random negative. 0.5 is chance | Comparing ranking ability, with moderately balanced classes |
| **PR-AUC / average precision** | Area under the precision–recall curve | **Rare positives** (fraud, rare diseases, anomalies). ROC-AUC can look great here even when precision is poor |
| **Log loss** (cross-entropy) | How much probability the model gave to the true class | You need good probabilities, not just a ranking. Punishes confident mistakes hard |
| **Brier score** | `mean((p − y)²)` | A gentler probability score; combines calibration and sharpness |

### More than two classes

- **Macro average:** compute the metric per class, then take a plain average. Every class counts equally, so it is good for spotting weak rare classes.
- **Micro average:** pool all predictions first. Dominated by large classes; for single-label tasks it equals accuracy.
- **Weighted average:** per-class metrics weighted by class size.
- **Top-k accuracy:** the right answer is among the k most likely predictions. Common for ImageNet (top-1, top-5).

### Multi-label (several labels per item)

- **Hamming loss:** the fraction of individual label decisions that are wrong.
- **Subset accuracy:** all labels for an item must be exactly right. A very strict measure.
- **Micro/macro F1** across labels.

## Regression

| Metric | Formula / idea | Use it when |
| --- | --- | --- |
| **MAE** | Mean of `\|error\|` | You want errors in the target's own units, robust to outliers |
| **MSE** | Mean of `error²` | A training loss; punishes large errors heavily |
| **RMSE** | `√MSE` | Same units as the target, but large errors still dominate |
| **R²** | `1 − SS_res / SS_tot` | Share of variance explained. **Can be negative on test data**, meaning worse than predicting the mean |
| **Adjusted R²** | R² penalised for the number of features | Comparing linear models with different numbers of features |
| **MAPE** | Mean of `\|error / actual\|` | Errors as percentages. **Breaks when actual values are near zero**, and punishes over- and under-prediction differently |
| **sMAPE / WAPE** | Symmetric or weighted percentage error | Safer percentage errors for business reporting |
| **RMSLE** | RMSE on `log(1 + y)` | Positive, skewed targets (prices, counts) where relative error matters |
| **Median absolute error** | Median of `\|error\|` | Heavy outliers you want to ignore |
| **Pinball (quantile) loss** | Asymmetric loss for a chosen quantile | Predicting ranges or quantiles, not just a single value |

Report **MAE and RMSE together**: a large gap between them tells you a few big errors dominate.

## Linear vs non-linear models

The prediction metrics above apply to every model. What differs is how you check the model itself.

### Linear and generalised linear models

Linear models come with a full statistical toolkit, because their assumptions are explicit:

| Check | What it tells you |
| --- | --- |
| **t-test on each coefficient** (p-value, CI) | Whether a feature's effect is distinguishable from zero |
| **F-test** | Whether the model as a whole beats an intercept-only model |
| **AIC / BIC** | Fit traded off against complexity, for comparing models. Lower is better; BIC penalises complexity more |
| **Likelihood ratio test** | Whether adding features to a nested model helps significantly |
| **Residual plots** | Missing non-linearity, outliers, changing variance |
| **VIF** (variance inflation factor) | Correlated features. Above about 5–10 makes coefficients unstable |
| **Breusch–Pagan test** | Heteroscedasticity (error variance changes with x) |
| **Durbin–Watson test** | Autocorrelated errors, common in time-ordered data |
| **Shapiro–Wilk / Q-Q plot** | Whether residuals are normal (matters for the p-values, not the predictions) |
| **Deviance, McFadden pseudo-R²** | Fit of logistic and other GLMs |
| **Hosmer–Lemeshow test** | Calibration of a logistic regression |

### Non-linear models (trees, boosting, neural networks, kernels)

These have no simple coefficients to test, so evaluation is mostly empirical:

- **Held-out test set and cross-validation** are the main evidence. Use stratified folds for classification, grouped folds when samples are related (the same patient or the same user), and time-ordered splits for time series.
- **Learning curves** (score against training-set size) show whether more data would help.
- **Training vs validation gap** shows overfitting.
- **Permutation importance and SHAP values** explain which features matter. They are explanations, not proof of cause and effect.
- **Always compare against a linear baseline.** On tabular data, and even on brain connectomes ([[brain-disorders-ml-literature]]), simple models are often hard to beat.

## Ranking, search and recommendation

| Metric | What it measures | Use it when |
| --- | --- | --- |
| **Precision@k** | Share of the top k results that are relevant | Users only look at the first page |
| **Recall@k / Hit rate@k** | Share of relevant items found in the top k | Retrieval for RAG; "did the right item show up at all?" |
| **MRR** (mean reciprocal rank) | Average of `1 / rank of the first relevant result` | One right answer per query (Q&A, known-item search) |
| **MAP** (mean average precision) | Precision averaged over each relevant item's position | Several relevant items per query |
| **NDCG@k** | Rewards relevant items near the top, with graded relevance | Search engines, recommendations with ratings |
| **Coverage, diversity, novelty** | How much of the catalogue gets recommended, and how varied it is | Avoiding a recommender that only shows bestsellers |

Offline ranking metrics often disagree with real user behaviour, so recommender systems are finally judged with **online A/B tests** (click-through rate, conversion, retention).

## Clustering

| Metric | Needs true labels? | Meaning |
| --- | --- | --- |
| **Silhouette score** | No | −1 to 1. How much closer points are to their own cluster than to the next one |
| **Davies–Bouldin index** | No | Lower is better. Average similarity between each cluster and its closest neighbour |
| **Calinski–Harabasz index** | No | Higher is better. Between-cluster vs within-cluster spread |
| **Adjusted Rand Index (ARI)** | Yes | About 0 for random labels, 1 for perfect agreement |
| **NMI / AMI** | Yes | Information shared between clusters and true labels (AMI adjusts for chance) |
| **Homogeneity, completeness, V-measure** | Yes | Whether each cluster holds one class, and whether each class stays in one cluster |

Internal metrics (no labels) favour round, well-separated clusters. Check that the clusters also make sense to someone who knows the domain.

## Time series and forecasting

| Metric | Use it when |
| --- | --- |
| **MAE, RMSE** | Errors in the series' own units |
| **MASE** | Error scaled by a naive "repeat the last value" forecast. **Below 1 beats naive**; comparable across series |
| **sMAPE, WAPE** | Percentage errors for business reporting |
| **Prediction interval coverage** | Whether 90% intervals contain the truth about 90% of the time |
| **CRPS** | Quality of a full probabilistic forecast |
| **Directional accuracy** | Whether the forecast gets up vs down right (trading, demand trends) |

**Never shuffle time series.** Use rolling-origin evaluation (backtesting): train on the past, test on the next window, then move forward.

## Anomaly and fraud detection

Positives are rare, so:

- Use **PR-AUC**, **precision@k** (how many of the top k alerts are real), and **recall at a fixed false-alarm rate**.
- Track the **false alarm rate per day**: an analyst can only check so many alerts.
- Avoid accuracy and, mostly, ROC-AUC, which both look excellent when 99.9% of cases are normal.

## Computer vision

| Task | Main metrics | Notes |
| --- | --- | --- |
| **Image classification** | Top-1 / top-5 accuracy, macro F1 | See the classification section |
| **Object detection** | **mAP** at IoU 0.5; COCO mAP averaged over IoU 0.50–0.95 | IoU (intersection over union) is box overlap; mAP averages precision over recall and classes |
| **Semantic segmentation** | **mIoU**, pixel accuracy | Pixel accuracy is fooled by large background areas |
| **Medical segmentation** | **Dice**, Hausdorff distance (HD95) | Dice = `2·IoU / (1 + IoU)`. Hausdorff catches boundary errors that Dice misses |
| **Keypoints / pose** | OKS-based mAP, PCK | Distance-based correctness of each joint |
| **Tracking** | MOTA, IDF1, **HOTA** | HOTA balances detection and keeping identities consistent |
| **Image restoration** | PSNR, SSIM, **LPIPS** | PSNR and SSIM compare pixels; LPIPS uses deep features and is closer to human judgement |

## Speech and audio

| Task | Metrics | Notes |
| --- | --- | --- |
| **Speech recognition** | **WER** = `(substitutions + deletions + insertions) / words`; CER | WER can exceed 100%. Normalise text (case, punctuation) the same way for every model |
| **Speaker verification** | **EER** (where false accepts equal false rejects), minDCF | Lower is better |
| **Text to speech** | **MOS** (human 1–5 rating), intelligibility via WER | Automatic MOS predictors exist but humans remain the reference |
| **Speech enhancement** | PESQ, STOI, SI-SDR | Quality, intelligibility, and signal-to-distortion in dB |
| **Audio generation** | Fréchet Audio Distance (FAD) | The audio version of FID |

## Classic NLP

| Metric | What it measures | Use it for |
| --- | --- | --- |
| **Perplexity** | `exp(mean negative log-likelihood per token)`. Lower is better | Language-model quality. **Only comparable between models with the same tokenizer** |
| **Exact match, token F1** | Whether the extracted answer matches the reference | Extractive Q&A (SQuAD-style) |
| **BLEU** | n-gram precision with a brevity penalty | Machine translation; weak at sentence level |
| **chrF** | Character n-gram F-score | Translation, especially for languages with rich word forms |
| **ROUGE** (1, 2, L) | n-gram and longest-common-subsequence overlap, recall-oriented | Summarisation |
| **METEOR** | Matching with stems and synonyms | Translation and captioning |
| **BERTScore** | Similarity of contextual embeddings | Paraphrase-tolerant comparison with a reference |
| **COMET** | A model trained to predict human translation scores | The current standard for machine translation |

Word-overlap metrics (BLEU, ROUGE) reward copying the reference wording. They correlate poorly with quality for open-ended text, which is why LLM evaluation moved on.

## LLMs

LLMs are evaluated on many layers at once.

### Capability benchmarks

| Area | Common benchmarks | Metric |
| --- | --- | --- |
| Knowledge and reasoning | MMLU-Pro, GPQA Diamond, Humanity's Last Exam (HLE) | Accuracy on multiple-choice or short answers |
| Maths | GSM8K (now saturated), MATH, AIME | Accuracy of the final answer |
| Coding | HumanEval, MBPP, LiveCodeBench | **pass@k**: chance that at least one of k samples passes the tests |
| Software engineering | SWE-bench Verified | Share of real GitHub issues resolved with passing tests |
| Instruction following | IFEval | Share of verifiable instructions followed ("answer in under 100 words") |
| Abstract reasoning | ARC-AGI | Puzzles solved |
| Human preference | Chatbot Arena (LMArena) | Bradley–Terry / Elo-style ratings from pairwise human votes |

**pass@k** is usually computed with an unbiased estimator: generate n samples, count c correct, then `pass@k = 1 − C(n−c, k) / C(n, k)`.

Benchmarks go stale fast. Once a benchmark is **saturated** (top models near 100%) or **contaminated** (test questions leaked into training data), its scores stop telling models apart. That is why newer benchmarks are harder, private, or refreshed regularly, like LiveCodeBench.

### Judging open-ended answers

- **Human evaluation:** the gold standard, but slow and expensive. Report inter-annotator agreement (see the tests section).
- **Pairwise preference:** show two answers and ask which is better. Report the **win rate**, or fit Bradley–Terry ratings across many comparisons. My [[llm-preference]] project predicted exactly these human votes from Chatbot Arena, scored by log loss.
- **LLM-as-a-judge:** a strong model grades answers against a rubric. It is cheap and scalable, but has known biases:
  - **Position bias:** it favours the first or second answer. Swap the order and average.
  - **Length bias:** it favours longer answers. Use length-controlled win rates (as AlpacaEval does).
  - **Self-preference:** it favours its own style.

  Always check a judge against human labels on a sample before trusting it.

### Quality and safety

| What | How it is measured |
| --- | --- |
| **Hallucination / factuality** | Share of claims supported by a source; factuality benchmarks; claim-level checks |
| **Faithfulness** (to a given document) | Whether every statement can be traced to the context |
| **Calibration** | Whether stated confidence matches actual accuracy (ECE, Brier) |
| **Toxicity and bias** | Classifier-based toxicity rates; bias benchmarks across demographic groups |
| **Jailbreak / prompt-injection robustness** | **Attack success rate** on a red-team set (lower is better) |
| **Refusal behaviour** | Over-refusal rate on safe prompts vs refusal rate on harmful ones |

### Efficiency (serving)

- **Time to first token (TTFT)** and **tokens per second**: how fast it feels.
- **Latency percentiles (p50, p95, p99)**: the slow tail matters more than the average.
- **Throughput** (requests or tokens per second at full load) and **cost per million tokens**.
- **Memory use**: what hardware it needs ([[local-llms-guide]]).

## RAG (retrieval-augmented generation)

Evaluate the two halves separately, then together:

| Stage | Metric | Question it answers |
| --- | --- | --- |
| Retrieval | **Recall@k**, MRR, NDCG | Did the right passages come back? |
| Retrieval | **Context precision** | How much of what came back is relevant? |
| Retrieval | **Context recall** | Does the retrieved context contain everything needed for the answer? |
| Generation | **Faithfulness / groundedness** | Is every claim in the answer supported by the context? |
| Generation | **Answer relevance** | Does the answer address the question? |
| Generation | **Citation accuracy** | Do the cited sources actually support the sentences that cite them? |
| End to end | Answer correctness vs a reference; human rating | Is the final answer right? |

Frameworks such as RAGAS compute these with an LLM judge. A low score then tells you where to look: a retrieval problem (fix chunking, embeddings, search) or a generation problem (fix the prompt or the model).

## Agents

An agent takes many steps, calls tools and changes things, so evaluation focuses on **outcomes and reliability**:

| Metric | What it measures |
| --- | --- |
| **Task success rate** | Share of tasks completed, checked by running tests or inspecting the final state, not by reading the agent's claims |
| **pass^k** | Chance the agent succeeds on **all** k repeated attempts at the same task. Measures reliability, introduced by τ-bench |
| **Steps, turns and tool calls per task** | Efficiency; successful runs often use fewer, more targeted calls |
| **Tool-call accuracy** | Right tool, valid arguments, correct order |
| **Trajectory quality** | Whether the path was sensible, judged step by step by humans or an LLM |
| **Cost and wall-clock time per task** | Tokens, money and time |
| **Safety violations** | Destructive or forbidden actions, policy breaks, data leaks |
| **Recovery rate** | How often the agent recovers after a tool error |

pass@k and pass^k answer different questions. **pass@k** asks "can it ever do this?", which is useful for research. **pass^k** asks "will it do this every time?", which is what matters in production. In τ-bench's original results, a model that solved most retail tasks on the first try fell to about 25% when it had to succeed 8 times in a row.

Common agent benchmarks include SWE-bench Verified (coding), τ-bench (customer service with tools), WebArena (web tasks), OSWorld (desktop computer use), GAIA (general assistant tasks) and Terminal-Bench (command-line tasks).

## MCP and tool use

The **Model Context Protocol (MCP)** is a standard way to connect models to tools and data sources ("MCP servers"). Evaluating an MCP setup means evaluating the model, the server and the interaction between them.

| Layer | Metric |
| --- | --- |
| **Tool selection** | Did the model choose the right tool, among many with similar names? |
| **Argument correctness** | Do the calls match the tool's JSON schema, with sensible values? |
| **Call success rate** | Share of calls that run without errors; how errors are handled |
| **End-to-end task success** | Is the final state correct (file created, database row updated, issue filed)? Checked by code |
| **Efficiency** | Tool calls and turns per task; tokens spent just on tool descriptions, which grows with every server you connect |
| **Latency** | Time per tool call and per task |
| **Security** | Prompt-injection success through tool outputs, "tool poisoning" via malicious tool descriptions, actions outside granted permissions |

MCP-specific benchmarks appeared in 2025:

- **MCP-Universe:** 231 tasks across 11 real MCP servers. The best model tested (GPT-5) succeeded on only 44% of tasks, and unfamiliar tools were a major failure cause.
- **MCPMark:** long create/read/update/delete workflows in Notion, GitHub, a filesystem, PostgreSQL and Playwright, reported as pass@1 and pass^4.
- **MCP-Bench:** 28 live servers with 250 tools, focused on multi-step tasks across tools.

For your own MCP server, a small test set of real tasks with **programmatic checks of the end state** is worth more than any general benchmark.

## Generative models (images, video, audio)

| Metric | What it measures | Notes |
| --- | --- | --- |
| **FID** (Fréchet Inception Distance) | Distance between feature distributions of real and generated images | Lower is better; needs thousands of samples; sensitive to the feature extractor |
| **Inception Score (IS)** | Confidence and variety of generated images | Older; ignores real data |
| **Precision / recall for generative models** | Quality (precision) vs coverage of the real distribution (recall) | Separates "realistic" from "diverse" |
| **CLIPScore** | Image–text match for text-to-image | Prompt adherence |
| **Human preference** | Pairwise votes, arena ratings, learned preference models (ImageReward, HPS) | Still the final word on quality |

## Reinforcement learning

- **Average episode return** (total reward), with the spread over several random seeds. RL results vary a lot between seeds, so report the mean and an interval, not the best run.
- **Success rate** for goal-based tasks.
- **Sample efficiency:** return reached after a given number of environment steps.
- **Regret** (bandits, online learning): reward lost compared with always making the best choice.
- **Human-normalised score** (Atari): 0 = random play, 100 = human level.

## Fairness and robustness

| Metric | Definition | Use it when |
| --- | --- | --- |
| **Demographic parity difference** | Gap in positive-prediction rates between groups | Outcomes should be equally distributed |
| **Equal opportunity** | Gap in true positive rates (recall) between groups | Qualified people should be treated equally |
| **Equalised odds** | Gaps in both TPR and FPR | A stricter version of the above |
| **Disparate impact ratio** | Ratio of positive rates; below 0.8 fails the "four-fifths rule" | Hiring and lending audits |
| **Calibration by group** | Whether a 70% score means 70% for every group | Risk scores |
| **Worst-group accuracy** | Accuracy on the weakest subgroup | Catches models that fail a minority group |
| **OOD / shifted-data accuracy** | Performance on new sites, regions or time periods | Real-world deployment |
| **Adversarial accuracy** | Accuracy under deliberate small perturbations | Security-sensitive models |

The fairness definitions can't all be satisfied at once when base rates differ between groups, so choosing one is a policy decision, not only a technical one.

## Calibration and uncertainty

A model is **calibrated** if, among cases it gives 80% confidence, about 80% are correct.

- **Reliability diagram:** plot confidence against actual accuracy, bin by bin.
- **ECE** (expected calibration error): the average gap between confidence and accuracy across bins.
- **Brier score and log loss:** proper scoring rules that reward both calibration and sharpness.
- **Conformal prediction:** gives prediction sets or intervals with a guaranteed coverage rate. Check that the empirical coverage matches the target, such as 90%.

Modern neural networks are often over-confident. Temperature scaling on a validation set is a cheap fix.

## Efficiency and deployment

- **Latency** (p50, p95, p99) and **throughput**.
- **Model size** (parameters, MB on disk) and **memory** at inference.
- **FLOPs per prediction**, and **energy** per prediction or per training run.
- **Monitoring after launch:**
  - **Data drift:** the Population Stability Index (PSI). As a rule of thumb, above 0.25 means a big shift. The KS test and chi-square tests also work.
  - **Prediction drift.**
  - **Delayed ground-truth metrics**, once real outcomes arrive.

## Statistical tests: is the difference real?

A model scoring 0.82 against 0.80 may just have been lucky with the test set. These tests and intervals tell you how much to trust a difference.

### Which test to use when

| Situation | Test or method |
| --- | --- |
| Confidence interval for any metric | **Bootstrap**: resample the test set with replacement many times and take percentiles |
| Confidence interval for accuracy or a proportion | **Wilson interval** (better than the simple ±1.96·SE for small samples) |
| Two classifiers, same test set | **McNemar's test**: uses only the cases where they disagree |
| Two models, any metric, same test set | **Paired bootstrap** or **permutation test** on the per-example differences |
| Two ROC-AUCs on the same data | **DeLong's test** |
| Two models compared with cross-validation | **Corrected resampled t-test** (Nadeau & Bengio) or **5×2cv paired t-test** (Dietterich). A plain t-test over folds is too optimistic, because folds share training data |
| Two models across several datasets | **Wilcoxon signed-rank test** |
| Many models across many datasets | **Friedman test**, then the **Nemenyi** post-hoc test, shown as a critical-difference diagram (Demšar, 2006) |
| Two forecasting models | **Diebold–Mariano test** |
| Online A/B test | **Two-proportion z-test** or t-test, with a **power analysis** beforehand to choose the sample size |
| LLM benchmark scores | Standard errors over questions; **clustered** standard errors when questions come in related groups; paired differences between models |
| Agreement between human labellers | **Cohen's kappa** (2 raters), **Fleiss' kappa** (many), **Krippendorff's alpha** (any number, missing labels allowed) |

### Running many tests

Comparing many models or metrics creates false positives by chance. Correct for it:

- **Bonferroni:** divide the significance level by the number of tests. Simple but strict.
- **Holm:** a step-down version of Bonferroni, always at least as powerful.
- **Benjamini–Hochberg:** controls the false discovery rate. Suited to large screens of many features or models.

### Tests for data and assumptions

| Test | Checks |
| --- | --- |
| **Kolmogorov–Smirnov** | Whether two samples come from the same distribution (drift in a numeric feature) |
| **Chi-square** | Independence or drift for categorical features |
| **Shapiro–Wilk** | Normality (of residuals, for example) |
| **Breusch–Pagan, Durbin–Watson** | Changing error variance and autocorrelated errors in regression |
| **Ljung–Box** | Leftover autocorrelation in forecast residuals |
| **Augmented Dickey–Fuller** | Whether a time series is stationary |

### Statistical vs practical significance

With a big enough test set, a 0.1% improvement becomes "significant". Always report the **effect size** (the actual difference, with its confidence interval) and ask whether it matters for the decision. Never report a p-value alone.

### A small example in Python

```python
import numpy as np
from sklearn.metrics import f1_score, matthews_corrcoef, average_precision_score
from statsmodels.stats.contingency_tables import mcnemar

# y_true: labels, y_prob_a: model A's probabilities, y_pred_a / y_pred_b: hard predictions
print("F1 ", f1_score(y_true, y_pred_a))
print("MCC", matthews_corrcoef(y_true, y_pred_a))
print("AP ", average_precision_score(y_true, y_prob_a))

# 95% bootstrap confidence interval for F1
rng = np.random.default_rng(0)
boot = []
for _ in range(2000):
    idx = rng.integers(0, len(y_true), len(y_true))
    boot.append(f1_score(y_true[idx], y_pred_a[idx]))
print("F1 95% CI", np.percentile(boot, [2.5, 97.5]))

# McNemar's test: do models A and B differ on the same test set?
a_ok, b_ok = y_pred_a == y_true, y_pred_b == y_true
table = [[np.sum(a_ok & b_ok), np.sum(a_ok & ~b_ok)],
         [np.sum(~a_ok & b_ok), np.sum(~a_ok & ~b_ok)]]
print("McNemar p =", mcnemar(table, exact=True).pvalue)
```

## Common pitfalls

- **Data leakage:** information from the test set reaching training, through preprocessing fitted on all the data, duplicates across splits, or the same patient in both. This is the most common cause of results that are too good to be true.
- **Tuning on the test set:** choosing hyperparameters or the "best epoch" by test score. Use a separate validation set, and touch the test set once.
- **Wrong split:** random splits for time series, grouped data or multi-site data overestimate real-world performance.
- **Accuracy on imbalanced data,** and ROC-AUC for very rare positives.
- **One seed, one split:** report the spread over several.
- **Benchmark contamination and saturation** for LLMs.
- **Goodhart's law:** when a measure becomes a target, it stops being a good measure. Models (and teams) learn to game whatever is measured, so look at actual failure cases, not just the number.
- **Cherry-picked baselines:** compare against a well-tuned simple model, not a weak strawman.

## Cheat sheet

| Scenario | Primary metric | Also report |
| --- | --- | --- |
| Balanced classification | Accuracy or macro F1 | Confusion matrix |
| Imbalanced classification | MCC, balanced accuracy or PR-AUC | Precision and recall at the chosen threshold |
| Medical screening | Sensitivity at a fixed specificity | Specificity, ROC-AUC with a CI, calibration |
| Probabilities used for decisions | Log loss or Brier | Reliability diagram, ECE |
| Regression | MAE or RMSE | R², a residual plot |
| Forecasting | MASE | Interval coverage, a naive baseline |
| Search and recommendations | NDCG@k, Recall@k | MRR, coverage, an online A/B test |
| Clustering with labels | ARI, NMI | Silhouette |
| Object detection | COCO mAP@[.5:.95] | mAP@0.5, per-class AP |
| Segmentation | mIoU or Dice | HD95 for medical images |
| Speech recognition | WER | CER, per-accent breakdown |
| Translation | COMET | chrF, human review |
| Code generation | pass@1 | pass@k, SWE-bench-style task success |
| Chat assistant | Human or judge win rate (length-controlled) | Safety and refusal rates |
| RAG system | Faithfulness + answer correctness | Retrieval recall@k, context precision |
| Agent or MCP workflow | Task success rate (checked by code) | pass^k, cost and steps per task, safety violations |
| Comparing two models | Paired bootstrap CI of the difference | McNemar or DeLong where they fit |

The metric is part of the experiment design, not an afterthought. Choose it before you train, check it against a baseline, put an interval around it, and look at the cases it gets wrong.

## Further reading

- Demšar, *Statistical comparisons of classifiers over multiple data sets*, JMLR 2006.
- Dietterich, *Approximate statistical tests for comparing supervised classification learning algorithms*, Neural Computation 1998.
- Chen et al., *Evaluating large language models trained on code* (the pass@k estimator), 2021.
- [τ-bench: tool-agent-user interaction benchmark (pass^k)](https://arxiv.org/abs/2406.12045)
- [MCP-Universe: benchmarking LLMs with real-world MCP servers](https://arxiv.org/abs/2508.14704)
- [MCPMark: stress-testing realistic MCP use](https://arxiv.org/pdf/2509.24002)
- [scikit-learn: metrics and scoring](https://scikit-learn.org/stable/modules/model_evaluation.html)
