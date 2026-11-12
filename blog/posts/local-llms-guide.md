---
title: Running LLMs locally, a practical guide
date: 2026-11-12
tags: [machine-learning, llms, linux]
related: [llm-preference]
summary: How to run open-weight language, vision, speech and image models on your own machine. Covers the tools, how much hardware you need, settings like temperature, the best models right now, fake models to avoid, and what changed in 2026.
---

<!-- markdownlint-disable MD014 -- "$ " prompts drive the terminal styling in blog.js -->

Running a language model on your own computer used to mean a server full of GPUs. In 2026 a laptop with a mid-range GPU, or any recent Mac, can run models that are genuinely useful for coding, writing, reading documents and even looking at images. Nothing leaves your machine, there is no subscription, and it works offline.

This guide covers what you need to know to get started and to choose well:

- the tools that run models, and how they compare
- how much memory and compute different models need
- how to configure them, including temperature and the other sampling settings
- the best open models right now, by hardware and by use case
- vision, audio, reasoning and image-generation models
- fake and tampered models, and how to avoid them
- what changed in 2026

> **A note on dates.** Open models move fast. The model names and rankings below are from November 2026. The concepts (memory, quantization, sampling) will stay true for much longer.

## The basics in five terms

- **Open-weight model:** a model whose trained weights you can download and run. "Open source" is often used loosely; many models share weights but not training data or code, and licences vary.
- **Parameters:** the size of the model, such as 8B (8 billion) or 27B. More parameters usually means smarter but slower and hungrier.
- **Quantization:** storing each weight in fewer bits (for example 4 bits instead of 16) so the model fits in less memory, at a small cost in quality.
- **GGUF:** the single-file model format used by llama.cpp, Ollama and LM Studio. Names like `Q4_K_M` or `Q8_0` describe the quantization level.
- **Context window:** how much text (in tokens) the model can consider at once. Longer context needs more memory.

## The tools

| Tool | What it is | Best for | Interface |
| --- | --- | --- | --- |
| **Ollama** | A background service with a simple CLI and a built-in model library | Getting started fast, scripts, connecting other apps | CLI + HTTP API (port 11434) |
| **LM Studio** | A desktop app for finding, downloading and chatting with models | People who prefer a GUI, comparing models side by side | GUI, `lms` CLI, API (port 1234) |
| **llama.cpp** | The C/C++ engine underneath most of these tools | Maximum control and the newest features first | CLI + `llama-server` |
| **vLLM** | A high-throughput server for NVIDIA GPUs | Serving many users or requests at once | Python / OpenAI-style API |
| **MLX / mlx-lm** | Apple's machine-learning framework | Fastest option on Apple Silicon Macs | Python / CLI |
| **Open WebUI** | A ChatGPT-style web interface | A nice front end for Ollama or any OpenAI-style API | Browser |
| **ComfyUI** | A node-based tool for image and video models | Image generation (FLUX, Qwen-Image and others) | Browser |

How they relate: **llama.cpp is the engine**, and Ollama and LM Studio are friendlier wrappers around it (Ollama also added an MLX backend for Apple Silicon Macs). Most new features, such as speculative decoding or quantized KV caches, appear in llama.cpp first and reach the others a few weeks later.

Most tools also speak the **OpenAI-compatible API**, so code written for a cloud API can usually point at `http://localhost:11434/v1` or `http://localhost:1234/v1` instead. LM Studio added an Anthropic-compatible endpoint in 2026 too.

**My pick:** start with **Ollama** if you like the terminal, or **LM Studio** if you want a GUI. Move to **llama.cpp** when you want to tune things, and to **vLLM** only if you are serving several users.

## How much hardware do you need?

### Memory is the first limit

A model has to fit in memory: GPU memory (VRAM) ideally, or system RAM if you accept slower speed. A quick estimate:

> **Memory ≈ parameters × bytes per weight + context (KV cache) + about 1 GB overhead**

| Model size | 16-bit (full) | 8-bit (`Q8_0`) | 4-bit (`Q4_K_M`) |
| --- | --- | --- | --- |
| 4B | ~8 GB | ~4.5 GB | ~2.5 GB |
| 8B | ~16 GB | ~8.5 GB | ~5 GB |
| 14B | ~28 GB | ~15 GB | ~9 GB |
| 27–32B | ~60 GB | ~32 GB | ~17–20 GB |
| 70B | ~140 GB | ~75 GB | ~42 GB |

These are weights only. Add the KV cache for your context length: a few hundred MB for a short chat, several GB at 32K+ tokens on a large model.

**4-bit (`Q4_K_M`) is the usual sweet spot.** Quality loss is small for most tasks. Below 4 bits, quality drops faster, especially for small models.

### Speed depends on memory bandwidth

Generating each token means reading (roughly) all the active weights once. So the ceiling on speed is:

> **Tokens per second ≲ memory bandwidth ÷ size of the active weights**

| Hardware | Memory bandwidth (approx.) | 8B at 4-bit (~5 GB): ceiling |
| --- | --- | --- |
| Laptop CPU with DDR5 | 60–90 GB/s | ~12–18 tok/s |
| RTX 4060 Laptop (8 GB) | ~256 GB/s | ~50 tok/s |
| RTX 4090 / 5090 desktop | ~1,000–1,800 GB/s | ~200+ tok/s |
| Apple M-series Max / Ultra | 400–800 GB/s | ~80–160 tok/s |

Real numbers come in below these ceilings, but the ranking holds. About 10 tokens per second already feels like comfortable reading speed.

Two consequences:

- **Partial GPU offload is slow.** If a model doesn't fit in VRAM, the layers in system RAM run at CPU speed and drag the whole model down.
- **Apple Silicon is unusually good** for big models, because its unified memory gives large capacity at high bandwidth.

### Mixture-of-experts (MoE) changes the maths

Many 2026 models are **MoE**: they have many "expert" sub-networks but use only a few for each token. For example, gpt-oss-20b has about 21B parameters in total but only about 3.6B active per token.

- **Memory** depends on the **total** parameters (all experts must be loaded).
- **Speed** depends on the **active** parameters.

So an MoE model runs much faster than a dense model of the same size. It also tolerates having some experts in system RAM better than a dense model would. That is why a 16 GB machine can run gpt-oss-20b at good speed.

### What fits where

| Your hardware | Realistic models |
| --- | --- |
| 8 GB VRAM or a 16 GB laptop | 4–12B dense at 4-bit, or a 20B-class MoE with some CPU offload |
| 12–16 GB VRAM | 14B dense, 20–30B MoE |
| 24 GB VRAM or a 32 GB Mac | 27–32B dense at 4-bit, the current sweet spot for quality |
| 64–128 GB (Mac, or multiple GPUs) | 70B dense, 100B+ MoE such as gpt-oss-120b |
| Phone or small laptop | 1–4B models such as Gemma 4 E2B / E4B |

My own laptop is an RTX 4060 with 8 GB of VRAM and 16 GB of RAM ([[fedora-on-rog-strix-g16]]). That puts it in the first row: 8B-class models run fully on the GPU and feel instant, and larger MoE models work with offload.

## Getting started

### Ollama

```bash
$ curl -fsSL https://ollama.com/install.sh | sh
$ ollama run gpt-oss:20b
>>> Explain quantization in two sentences.
$ ollama list
$ ollama ps
```

`ollama run` downloads the model the first time, then opens a chat. `ollama ps` shows what is loaded and how much of it sits on the GPU (`100% GPU` is what you want). Browse model names and tags at [ollama.com/library](https://ollama.com/library).

Ollama also runs any GGUF file straight from Hugging Face:

```bash
$ ollama run hf.co/<user>/<repo>-GGUF:Q4_K_M
```

Useful server settings, set as environment variables on the Ollama service:

```bash
$ sudo systemctl edit ollama
```

```ini
# file: /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_CONTEXT_LENGTH=16384"
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_KV_CACHE_TYPE=q8_0"
```

```bash
$ sudo systemctl restart ollama
```

The first line raises the default context window. The other two lower memory use, which lets you fit more context.

### LM Studio

Download it from [lmstudio.ai](https://lmstudio.ai), search for a model, and pick a quantization. LM Studio shows whether each file will fit in your GPU. It also has a command-line tool:

```bash
$ lms ls
$ lms load <model-name>
$ lms server start
```

### llama.cpp

```bash
$ llama-server -hf ggml-org/gpt-oss-20b-GGUF -c 16384 -ngl 99 --port 8080
```

- `-hf` downloads straight from Hugging Face.
- `-c` sets the context length.
- `-ngl 99` puts all layers on the GPU (lower it if you run out of VRAM).

Open `http://localhost:8080` for a built-in chat page.

### Talking to it from code

Every tool above speaks the OpenAI-style API:

```bash
$ curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-oss:20b", "messages": [{"role": "user", "content": "Hello"}], "temperature": 0.7}'
```

## Settings that matter

### Sampling settings

| Setting | What it does | Typical range |
| --- | --- | --- |
| **temperature** | Randomness. Low is focused and repeatable; high is varied and creative | 0.0–1.2 |
| **top_p** | Only sample from the most likely words whose probabilities add up to *p* | 0.8–0.95 |
| **top_k** | Only sample from the *k* most likely words | 20–64 |
| **min_p** | Drop words much less likely than the top choice. A good modern alternative to top_p | 0.0–0.1 |
| **repeat / presence penalty** | Discourage repeating the same words | 1.0–1.5 |
| **seed** | Fix it to get the same output for the same input | any number |
| **context length** (`num_ctx`) | How much text the model sees. Too low and it silently forgets the start | 8K–32K for most uses |

### Starting presets by task

| Task | temperature | Notes |
| --- | --- | --- |
| Code, maths, data extraction | 0.0–0.3 | You want the most likely answer, every time |
| Q&A over your documents (RAG) | 0.2–0.5 | Stay close to the source text |
| General chat, writing help | 0.6–0.8 | A balance of accuracy and variety |
| Brainstorming, fiction | 0.9–1.2 | More surprise, more risk of nonsense |

**The model card wins over any table.** Labs tune their models for specific settings, and reasoning models in particular can loop or degrade at temperature 0. Some examples at the time of writing:

| Model | Recommended settings (from the model card) |
| --- | --- |
| Qwen3.6, thinking mode | temperature 1.0, top_p 0.95, top_k 20, min_p 0 (0.6 for precise coding) |
| Qwen3.6, non-thinking mode | temperature 0.7, top_p 0.8, top_k 20, presence penalty 1.5 |
| gpt-oss | temperature 1.0, top_p 1.0 |
| Gemma family | temperature 1.0, top_k 64, top_p 0.95 |

### Saving your settings

In Ollama, a **Modelfile** turns a model plus settings into your own named model:

```text
# file: Modelfile
FROM gpt-oss:20b
PARAMETER temperature 0.7
PARAMETER num_ctx 16384
SYSTEM """You are a concise assistant. Answer in plain English."""
```

```bash
$ ollama create my-assistant -f Modelfile
$ ollama run my-assistant
```

In LM Studio, the same settings live in the right-hand panel and can be saved as a preset.

## The best open models right now (November 2026)

Rankings differ between sources, and many comparison sites are vendor-influenced, so treat these as a starting shortlist and test on your own tasks.

| Tier | Models people recommend most | Notes |
| --- | --- | --- |
| Small (phones, 8 GB) | Gemma 4 E2B / E4B, Gemma 4 12B | E2B and E4B are built for phones and laptops; 12B is the usual pick below 12 GB. Apache 2.0 |
| Mid (16 GB) | **gpt-oss-20b**, Gemma 4 26B A4B | Both are MoE (about 3.6B and 3.8B active), so they run fast. gpt-oss-20b is the most common 16 GB pick |
| Sweet spot (24 GB, 32 GB Mac) | **Qwen3.6 27B**, Qwen3.8 27B, Gemma 4 31B | Dense models. The Qwen pair are strong at coding; Apache 2.0 licences |
| Large (80–128 GB) | gpt-oss-120b | MoE, so fast for its size |
| Frontier (datacentre) | Kimi K3, DeepSeek V4-Pro, GLM-5.2 | Top open scores, but huge (DeepSeek V4-Pro is about 1.6T parameters, Kimi K3 about 2.8T). GLM-5.2 and DeepSeek are MIT; Kimi K3 has a custom licence |

## Models by use case

| Use case | Good open choices | Tip |
| --- | --- | --- |
| **Coding** | Qwen3.6 27B, gpt-oss-20b | Low temperature, long context. Pair with an editor plugin pointed at the local API |
| **General chat and writing** | Gemma 4, Qwen3.6, gpt-oss | Pick the largest that fits fully on your GPU |
| **Reasoning, maths** | Thinking modes of Qwen3.6 and gpt-oss | See the next section |
| **Chat with your documents (RAG)** | Any of the above, plus an embedding model | Embeddings turn text into vectors for search. Ollama and LM Studio both serve them |
| **Agents and tool calling** | Qwen3.6, gpt-oss | Check the model card says it was trained for tool use |
| **Private or offline work** | Any model that fits | The whole point of running locally |

## Types of models beyond text

### Thinking and reasoning models

A **reasoning model** writes out a chain of thought before answering. It is usually wrapped in `<think>` tags or shown in a collapsible box. It is much better at maths, logic and multi-step coding, but each answer can take hundreds or thousands of extra tokens, so it is slower.

Most 2026 models are **hybrid**: you can turn thinking on or off per request.

```bash
$ ollama run gpt-oss:20b --think=low
$ ollama run <model> --think=false
```

- Qwen models think by default. Thinking can be turned off through the chat template, or per request in tools that support it.
- gpt-oss has three reasoning levels (low, medium, high), set in the system prompt or with `--think=low|medium|high` in Ollama. It ignores plain `true`/`false`.
- Leave thinking **off** for chat and simple questions, and turn it **on** for hard problems.

### Vision-language models

These models take images as well as text: reading screenshots, charts, handwriting or photos. The Qwen VL family (Qwen3-VL) and Gemma models are popular open choices. In Ollama or LM Studio, you drag an image into the chat or pass a file path. Vision models need extra memory for the image encoder.

### Audio models

- **Speech to text:** Whisper large-v3 is still the standard for coverage of many languages. NVIDIA's Parakeet TDT 0.6B is much faster for English. Both run well locally with tools like whisper.cpp or faster-whisper.
- **Text to speech:** Kokoro-82M is tiny and good. Chatterbox Multilingual covers 23+ languages.

### Omni models

**Omni** models take text, images and audio in one model, and some also speak. Open examples from 2026 include:

- Qwen3-Omni and Qwen3.5-Omni
- NVIDIA Nemotron 3 Nano Omni (built on a 30B-A3B MoE)
- Xiaomi MiMo-V2.6

Tool support is newer here, so expect to use vLLM or the model's own code rather than Ollama.

### Image generation

Image models use a different stack: **ComfyUI** or a similar tool, not Ollama.

| Model | Strength | Licence and VRAM |
| --- | --- | --- |
| FLUX.2 [klein] 4B | Fast, good quality | Apache 2.0, about 5 GB VRAM |
| FLUX.2 [dev] | Top image quality | Non-commercial licence |
| Qwen-Image-2512 | Good all-rounder, strong at text in images | Apache 2.0 |
| Qwen-Image-2.1 | Tops open leaderboards; generation and editing | Research licence, non-commercial |
| Z-Image-Turbo | Fast on modest GPUs | Check the model card |

**Check the licence** before using any image model commercially. In 2026, the best-quality model and the commercially usable one are often not the same.

## Fake and tampered models

Model hubs are now a target for attackers, and "it has a lot of downloads" is no proof of safety:

- **May 2026:** a repository impersonating an OpenAI "Privacy Filter" model reached Hugging Face's trending list and was downloaded about 244,000 times before removal. It installed infostealer malware on Windows. Sibling repositories from the same group used GGUF-style names to look like ordinary quantized models.
- **October 2026:** another wave of fake models carrying malware reappeared days after takedowns. Some ran malicious code while the model was still loading.

Other "spoofed" models are not malware but are still misleading:

- **Renamed or distilled models:** a small model fine-tuned on a big model's outputs, uploaded under a name that suggests it *is* the big model.
- **"Uncensored" or "abliterated" fine-tunes:** safety training deliberately removed. Some people want this, but you should know when you are running one.
- **Mislabelled quantizations:** a file called `Q8` that is really `Q4`, or a broken conversion that quietly gives worse answers.

### A safety checklist

- Download from the **official organisation** (for example `Qwen/`, `google/`, `openai/`, `meta-llama/`) or a **well-known quantizer** (such as `ggml-org`, `unsloth` or `bartowski`).
- Prefer **GGUF or safetensors** files. Avoid old pickle formats (`.bin`, `.pt`, `.pkl`), which can run code when loaded.
- **Never** enable `trust_remote_code` for a model you don't trust. It runs Python code from the repository.
- Treat model files like programs you download: check the uploader, the creation date and the community discussion, not just the download count.
- Read the **licence**, especially for commercial use.

## What's new in 2026

- **Mixture-of-experts everywhere.** Most new open models are MoE, which makes big models fast enough for consumer hardware.
- **Multi-token prediction (MTP) speculative decoding.** Models predict several tokens at once and verify them. It landed in llama.cpp in May 2026, then in Ollama and LM Studio, with roughly 1.5–3× faster generation depending on model and hardware.
- **Hybrid thinking.** One model, with reasoning switched on only when you need it.
- **Better low-bit formats.** 4-bit formats such as MXFP4 and NVFP4, plus quantization-aware training, which trains the model to expect 4-bit weights so it loses less quality.
- **Apple MLX goes mainstream.** Ollama added an MLX backend for Apple Silicon, alongside MLX-native tools like mlx-lm.
- **Local servers grow up.** LM Studio gained a headless server mode, continuous batching for parallel requests, and Anthropic-compatible endpoints. Ollama added coding-agent integrations.
- **Small models got good.** 2–4B models now run on phones and handle everyday tasks.
- **Omni models.** Text, vision and audio in one open model.

## A sensible way to start

1. Install **Ollama** or **LM Studio**.
2. Pick the **largest model that fits fully in your GPU** at 4-bit, using the "What fits where" table.
3. Use the **model card's recommended settings**, and set the context length deliberately.
4. Try it on **your own tasks**, not just benchmarks. Swap models freely, since downloading is the only cost.
5. Only download from **sources you trust**.

## Sources

- [The Best Open Source LLMs, November 2026 (Morph)](https://www.morphllm.com/best-open-source-llm)
- [Best Local LLMs, November 2026 (BenchLM)](https://benchlm.ai/best/local-llm)
- [Best Local LLMs to Run in 2026, by Hardware Tier (CTAIO)](https://ctaio.dev/en/local-ai/best-local-llm/)
- [Best Local LLM for Coding in 2026 (Atomic Chat)](https://atomic.chat/blog/guides/best-local-llms-for-coding)
- [Open Source and Open-Weight LLMs to Run Locally in 2026 (Hugging Face blog)](https://huggingface.co/blog/daya-shankar/open-source-llm-models-to-run-locally)
- [Local AI runtime update, May 2026 (Codersera)](https://codersera.com/blog/local-ai-runtimes-may-2026-update/)
- [Ollama vs LM Studio vs vLLM vs llama.cpp vs MLX 2026 (Codersera)](https://codersera.com/blog/ollama-vs-lm-studio-vs-vllm-vs-llama-cpp-vs-mlx-2026/)
- [Running LLMs locally in 2026 (Ajay Kumar)](https://www.ajayk.sh/blog/local-llms-2026-ollama-llama-cpp-lm-studio/)
- [Qwen3.6 – how to run locally (Unsloth)](https://unsloth.ai/docs/models/qwen3.6.md)
- [Qwen3.6 27B on Groq (model settings)](https://console.groq.com/docs/model/qwen/qwen3.6-27b.md)
- [Gemma 4 model card (Google)](https://ai.google.dev/gemma/docs/core/model_card_4)
- [gpt-oss: how to run (Unsloth)](https://unsloth.ai/docs/models/gpt-oss-how-to-run-and-fine-tune)
- [Qwen3.8 27B, DeepSeek V4 Pro: a huge week for open-weight AI (Kaitchup)](https://kaitchup.substack.com/p/qwen38-27b-nemotron-35-muse-deepseek)
- [GLM-5.2 vs DeepSeek V4 vs Qwen3 (Developers Digest)](https://www.developersdigest.tech/blog/glm-5-2-vs-deepseek-v4-vs-qwen3-open-weights-coding-showdown)
- [Open source AI models 2026: vision, speech, image (Morph)](https://www.morphllm.com/open-source-ai-models)
- [Best open-source image models to self-host in 2026 (Pinggy)](https://pinggy.io/blog/best_free_open_source_ai_image_generators_to_self_host/)
- [Best multimodal open-source model in 2026 (Ertas)](https://www.ertas.ai/best/best-multimodal-open-source-model)
- [NVIDIA Nemotron 3 Omni report](https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3-Omni-report.pdf)
- [Malicious Hugging Face model masquerading as OpenAI release (CSO Online)](https://www.csoonline.com/article/4169407/malicious-hugging-face-model-masquerading-as-openai-release-hits-244k-downloads.html)
- [Fake AI models return to Hugging Face after takedown (TechInformed)](https://techinformed.com/fake-ai-models-return-to-hugging-face-after-takedown/)
