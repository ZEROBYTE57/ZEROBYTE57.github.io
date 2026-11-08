---
title: Machine learning for brain disorders, where the current research leads to.
date: 2026-11-08
tags: [machine-learning, gnn, medical-imaging, research]
related: [cxb]
summary: A short review of how graph neural networks and other models are used to study autism, ADHD, depression and schizophrenia from brain scans, how well they work, and where the field still falls short.
---

Can a computer tell from a brain scan whether someone has autism, ADHD or depression? Hundreds of papers have tried, mostly using **resting-state fMRI**, which records how brain regions fluctuate together while a person lies still in the scanner.

I read a lot of this literature as background for my dissertation ([[cxb]]). This post sums up what the published work found. It doesn't cover my own method or results.

## How these studies work

Almost every study follows the same pipeline:

1. **Split the brain into regions** using an atlas, such as AAL (116 regions) or CC200 (200 regions).
2. **Measure connectivity** between every pair of regions, usually as a correlation of their signals over time. The result is a **connectome**: a matrix, or a graph, of how strongly each pair of regions is linked.
3. **Train a model** to tell patients from controls using that connectome.
4. **Explain the model**: ask which regions or connections drove the prediction, and present them as possible **biomarkers**.

Since a connectome is a graph, **graph neural networks (GNNs)** became the popular choice. There is an overview of GNN types in [[gnn-architectures]].

### The usual datasets

| Disorder | Common public datasets |
| --- | --- |
| Autism (ASD) | ABIDE I and II: about 2,000 subjects from 17+ sites |
| ADHD | ADHD-200 |
| Depression (MDD) | REST-meta-MDD |
| Schizophrenia and others | SRPBS, plus various smaller cohorts |
| Alzheimer's disease | ADNI |

Almost all of these are **multi-site**: data pooled from many hospitals, each with its own scanner and settings. That turns out to matter a lot.

## Key findings from the literature

**1. Many models, few that clearly win.** Well-known brain models include BrainNetCNN ([Kawahara et al., 2017](https://doi.org/10.1016/j.neuroimage.2016.09.046)), BrainGNN ([Li et al., 2021](https://doi.org/10.1016/j.media.2021.102233)) and the Brain Network Transformer ([Kan et al., 2022](https://doi.org/10.52202/068431-1855)). BrainGB ([Cui et al., 2023](https://doi.org/10.1109/tmi.2022.3218745)) standardised how they are built and compared.

**2. Simple models are hard to beat.** A large comparison on ABIDE, PNC, HCP and ABCD found that classical machine learning matches or beats graph deep learning on connectomes. It also found that GNN message passing gets worse as the graph gets denser ([Han et al., 2026](https://doi.org/10.1038/s44387-025-00067-x)).

**3. Realistic accuracy is modest.** On ABIDE I and II together (2,013 subjects, harmonised), GCN, GAT and SAGPool models reach about **61% balanced accuracy** for autism (Lee et al., *Psychiatry Research: Neuroimaging*, 2026). Some papers on the same data report 90% or more. The gap usually comes down to how the data is split and checked, not to a better model.

**4. The "biomarkers" don't agree with each other.** A systematic review of 65 GNN studies on ADHD, autism, depression and schizophrenia found that the brain regions models flag as important vary greatly from study to study. Those regions were mostly checked only by comparing them with earlier papers ([Chan et al., 2025](https://doi.org/10.1016/j.neuroimage.2025.121422)). One interpretable brain GNN states plainly that real brain data has no known ground truth, so its explanations could only be scored on synthetic graphs ([Zheng, Yu & Chen, 2024](https://doi.org/10.1016/j.neunet.2024.106147)).

**5. The scanner can be a shortcut.** Data from each site carries a scanner "fingerprint", and models can learn to recognise the site instead of the disorder ([Abraham et al., 2017](https://doi.org/10.1016/j.neuroimage.2016.10.045)). Outside the brain, the same thing happened with chest X-rays, where a model learned the hospital ([Zech et al., 2018](https://doi.org/10.1371/journal.pmed.1002683)) and COVID-19 detectors picked up shortcuts instead of disease ([DeGrave et al., 2021](https://doi.org/10.1038/s42256-021-00338-7)).

**6. Harmonisation helps, but has traps.** ComBat ([Johnson et al., 2007](https://doi.org/10.1093/biostatistics/kxj037)) removes site differences statistically and is widely used on connectivity data ([Yu et al., 2018](https://doi.org/10.1002/hbm.24241)). Used carelessly, though, batch correction can exaggerate group differences ([Nygaard et al., 2016](https://doi.org/10.1093/biostatistics/kxv027)).

**7. Leakage inflates results.** Letting information from the test set leak into training, for example by fitting preprocessing on all the data, measurably inflates connectome prediction performance ([Rosenblatt et al., 2024](https://doi.org/10.1038/s41467-024-46150-w)). A 2026 review of GNN evaluation found that only 2 of 25 core studies ran a significance test (Kurashkin et al., *Machine Learning and Knowledge Extraction*, 2026).

## How effective is it?

Effective enough for research, not yet for a clinic:

- **Within one site**, models often look strong. **Across sites**, which is what a real clinic would face, accuracy for autism typically falls to about 60–70%.
- **Simple baselines** (logistic regression, an MLP on the connectivity values) are often as good as complex GNNs.
- **Very high reported accuracies** should be read carefully: check whether the test sites were kept fully separate, whether harmonisation was fitted only on training data, and whether a significance test was done.

## Where it is useful today

- **Research tool for biomarker discovery.** Models point to connections worth studying further, as hypotheses, not answers.
- **Subtyping.** Grouping patients into subtypes from their brain networks, for example with prototype-based models like BPI-GNN (Zheng et al., *NeuroImage*, 2024).
- **Decision support, in future.** As a second opinion next to clinical assessment, never on its own.
- **Quality control for multi-site studies.** The same models are good at detecting site effects, which helps clean up large studies.

## Current limitations

- **No ground truth.** Nobody knows which connections truly mark autism or depression, so explanations can't be checked directly.
- **Small, noisy, heterogeneous data.** A few thousand subjects at most, with scanner, age and sex differences mixed in.
- **Site effects and shortcuts.** High accuracy can come from recognising the scanner rather than the disorder.
- **Explanations can mislead.** Saliency maps can look sensible without reflecting what the model does (Adebayo et al., NeurIPS 2018), and post hoc explanations can miss spurious signals (Adebayo et al., ICLR 2022).
- **Inconsistent reporting.** Different splits, atlases and preprocessing make papers hard to compare.

## Future directions

- **Ground-truth testing of explanations.** Benchmarks like GraphXAI ([Agarwal et al., 2023](https://doi.org/10.1038/s41597-023-01974-x)) score explainers where the right answer is known. The review by Chan et al. calls for the same kind of testing for brain models.
- **Out-of-distribution evaluation.** Testing on hospitals the model has never seen, as in BrainOOD (Xu et al., ICLR 2025), instead of random splits.
- **Better harmonisation.** Learned methods such as adversarial unlearning ([Dinsdale et al., 2021](https://doi.org/10.1016/j.neuroimage.2020.117689)) and DeepComBat ([Hu et al., 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11273293/)).
- **Brain foundation models.** Models pretrained on many datasets, then adapted to each disorder, such as BrainGFM (Wei et al., ICLR 2026).
- **Stricter reporting.** Fixed seeds, significance tests, simple baselines and leakage checks as standard (Kurashkin et al., *Machine Learning and Knowledge Extraction*, 2026).

## Takeaway

Machine learning on brain connectomes has produced many models and many candidate biomarkers. The honest picture is more modest:

- Accuracy across hospitals is around 60–70%.
- Simple models compete with complex ones.
- The regions models highlight are rarely checked against a known answer.

The most useful progress now is less about new architectures and more about **testing models properly**.
