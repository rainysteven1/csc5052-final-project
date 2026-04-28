# SpeakSure++ Hugging Face 预训练模型选型与下载清单

按 2026-04-24 在 Hugging Face 可见的 model card 信息整理。

这份文档的目标不是“把所有节点都换成深度学习模型”，而是给你一套可以直接下载、直接加载预训练权重、尽量不训练的可落地方案。

结合你现在的服务拆分：

- `services/agent/src/asr/`：负责音频前处理、ASR、VAD 这类运行时能力
- `services/agent`：统一承载 transcript 后处理、语言识别、标点恢复、语义 embedding、情感/韵律 proxy 这类模型与分析逻辑
- `coaching` / `feedback`：依然更适合保留给 MiniMax 这类 LLM，而不是单独下一个 HF 分类模型

---

## 1. 先给结论

如果你现在要做一个“够用、能演示、实现成本低”的版本，我建议先下载这 4 类：

| 优先级 | 节点 | 推荐模型 | 放置目录 |
| --- | --- | --- | --- |
| P0 | ASR 主模型 | `openai/whisper-large-v3` 或 `openai/whisper-large-v3-turbo` | `services/agent/models/asr/` |
| P0 | VAD / speech segmentation | `pyannote/segmentation-3.0` | `services/agent/models/asr/` |
| P0 | transcript 语言识别 | `papluca/xlm-roberta-base-language-detection` | `services/agent/models/` |
| P0 | transcript 标点恢复 | `FireRedTeam/FireRedPunc` 或英文场景下 `felflare/bert-restore-punctuation` | `services/agent/models/` |

如果你还想把“prosody / uncertainty”做得更像 DL 驱动，再补这 2 类：

| 优先级 | 节点 | 推荐模型 | 放置目录 |
| --- | --- | --- | --- |
| P1 | prosody / affect proxy | `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` | `services/agent/models/` |
| P1 | semantic retrieval / example matching | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | `services/agent/models/` |

不建议你一上来就下很多“实验性质很强”的 fluency / disfluency 小模型，因为：

- 很多只支持英文
- 很多更偏 stuttering，不是你要的 public speaking uncertainty
- 很多 model card 很新，但泛化性、维护度、推理依赖都不稳定

---

## 2. 节点级模型表

| 环节 | 是否建议上 DL | 推荐模型 | 备选 | 任务说明 | 推荐服务 | 建议本地目录 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ASR 主链 | 强烈建议 | `openai/whisper-large-v3` | `openai/whisper-large-v3-turbo`、`distil-whisper/distil-large-v3` | 语音转文本主模型，优先走稳定 ASR 主链 | `services/agent` | `services/agent/models/asr/openai__whisper-large-v3` | `whisper-large-v3` 更适合做你这里的“标准 ASR 主模型”；`turbo` 更快，但如果你要保守一些，先用 `large-v3` 更稳 |
| VAD / speech region | 建议 | `pyannote/segmentation-3.0` | `pyannote/voice-activity-detection` | 做 speech / non-speech 切分，辅助 ASR 分段和 pause 统计 | `services/agent` | `services/agent/models/asr/pyannote__segmentation-3.0` | `segmentation-3.0` 需要接受 HF 条款并带 token；可同时做 VAD / overlap 相关处理 |
| transcript 语言识别 | 建议 | `papluca/xlm-roberta-base-language-detection` | 无需备选时可直接用它 | 识别 transcript 语言，用于中英样本路由和后续策略切换 | `services/agent` | `services/agent/models/papluca__xlm-roberta-base-language-detection` | 支持 20+ 语言，适合作为 transcript 级 LID |
| 标点恢复 | 建议 | `FireRedTeam/FireRedPunc` | `felflare/bert-restore-punctuation` | 给 ASR 文本补标点，改善 segmentation / lexical 分析输入质量 | `services/agent` | `services/agent/models/FireRedTeam__FireRedPunc` | 如果你要中英兼顾，优先 `FireRedPunc`；如果只做英文、想依赖更轻，可用 `felflare` |
| prosody / affect proxy | 可选但有价值 | `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` | 先不换也行 | 输出 arousal / dominance / valence，可作为“紧张、犹豫、情绪起伏”的 proxy 特征 | `services/agent` | `services/agent/models/audeering__wav2vec2-large-robust-12-ft-emotion-msp-dim` | 它不是直接做“不确定性”分类，而是给你可解释的连续声学情绪特征 |
| semantic retrieval / example matching | 可选 | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | 英文场景可用 `sentence-transformers/all-MiniLM-L6-v2` | 把 transcript / feedback / exemplar 做 embedding，方便找相似案例或提示模板 | `services/agent` | `services/agent/models/sentence-transformers__paraphrase-multilingual-mpnet-base-v2` | 如果后面你要“找相似表达问题片段”，这个很有用 |
| lexical hedge / uncertainty 分类 | 不建议现在就上 | `ChrisLiewJY/BERTweet-Hedge` | 先用规则 + LLM | 英文 hedge 文本分类 | `services/agent` | `services/agent/models/ChrisLiewJY__BERTweet-Hedge` | 更像社媒文本 hedge detector，不是专门为口语公开表达设计，只适合做实验性增强 |
| disfluency / stuttering | 不建议现在主用 | `pmootr/stuttering-detection-wavlm-lora` | 先用规则 | 更偏 stuttering event 分类 | `services/agent` | `services/agent/models/pmootr__stuttering-detection-wavlm-lora` | 任务更像口吃检测，不完全等价于 filler / hesitation / self-repair |

---

## 3. 哪些节点不建议下 HF 模型

这几块我建议你暂时别额外找 DL 模型：

| 节点 | 推荐方式 | 原因 |
| --- | --- | --- |
| `context` | 配置 / 规则 | 它本质是场景权重与策略，不需要模型 |
| `coaching` | MiniMax / LLM | 这是融合解释、归因、总结，LLM 比分类模型更合适 |
| `feedback` | MiniMax / LLM | 这是生成式任务，不适合再找一个小 HF 分类头硬顶 |
| `filler` / `self-repair` 初版 | 规则 + 正则 + 时间特征 | 对你的 demo 价值很高，而且比硬上小模型稳定 |

也就是说，比较合理的边界是：

- 音频前端：DL
- transcript 清洗：DL + 规则
- 最终解释和建议：LLM

---

## 3.1 ASR 里 Whisper 和 Qwen 的取舍

如果你明确说 `Qwen 7B` 不考虑，那我的建议就是：

| ASR 内部角色 | 对应模型 | 用法建议 |
| --- | --- | --- |
| 标准转写主模型 | `openai/whisper-large-v3` | 作为默认 ASR 主链，负责绝大多数音频的稳定转写 |
| 快速版主模型 | `openai/whisper-large-v3-turbo` | 如果你更在意速度，可以替代上面那条主链 |
| repo 结构里保留的 Qwen 实现 | 根目录 `Qwen3-ASR/` 子模块 | 先保留仓库结构，但不纳入当前 CPU-only 主部署方案 |

更具体地说：

- `Whisper-large` 负责“把音频稳稳转成 transcript”
- `Qwen` 这条线当前先不进生产主链

所以在你当前这个“服务器只有 CPU”前提下，`services/agent/src/asr/` 更合理的结构是：

```text
asr_router
├── whisper_large_v3         # 默认主链
├── pyannote_segmentation    # 切段 / VAD
└── optional_qwen_branch     # 保留接口，不进入当前部署
```

如果你现在只做一条最稳的主链：

- 先上 `Whisper-large-v3`
- `Qwen3-ASR` 代码仓先保留，但不作为当前 CPU server 方案的一部分

这意味着你当前文档和实现应该按下面理解：

- 当前生产部署：Whisper 主链
- 当前研究预留：Qwen 子模块
- 当前不建议：把 Qwen 7B 拉到 CPU-only 机器上做主推理

---

## 3.2 只有 CPU 服务器时，要不要转 ONNX

结论先说：

| 模型类型 | 是否建议转 ONNX | 结论 |
| --- | --- | --- |
| Whisper ASR | 强烈建议 | `是`，而且最好配合 INT8 / 量化版 |
| pyannote segmentation / VAD | 建议 | `最好是`，至少优先选现成 ONNX 版本 |
| 语言识别 / 标点恢复这类小文本模型 | 可选 | `不一定`，先用 PyTorch / Transformers 也能跑 |
| sentence embedding / 情感 proxy | 视延迟要求 | 如果并发高、CPU紧张，建议后续再转 |

更直接一点：

- 对你这种 CPU-only server，`Whisper` 是最应该优先 ONNX 化的
- 小文本模型先不一定要 ONNX
- `Qwen 7B` 既然你已经不考虑，那就不用为它做 ONNX 设计

### 为什么 Whisper 最需要 ONNX

因为 ASR 是整条链最重的一环。

你如果直接在 CPU 上跑原始 PyTorch `whisper-large-v3`：

- 内存压力大
- 推理延迟高
- 并发基本不好看

而 ONNX Runtime 官方文档明确支持量化，8-bit 量化就是它的主推优化路径之一。

同时，Hugging Face 上已经有现成的 ONNX 版本可参考：

- `onnx-community/whisper-large-v3-ONNX`
- `onnx-community/whisper-large-v3-turbo`

所以对你来说，最现实的路径不是“先自己手搓导出”，而是：

1. 先选 ONNX 现成仓或用 Optimum 导出
2. 优先跑 `Whisper + ONNX Runtime + CPUExecutionProvider`
3. 如果还慢，再继续往 int8 / 更小模型走

### CPU-only 下我更推荐的 ASR 取舍

如果服务器真的只有 CPU，我建议优先级改成这样：

1. 首选：`onnx-community/whisper-large-v3-turbo`
2. 次选：`onnx-community/whisper-large-v3-ONNX`
3. 如果还是太慢：考虑更小的 Distil-Whisper ONNX 变体

原因：

- `large-v3` 更稳
- `turbo` 更快
- CPU-only 环境里，速度通常比那一点理论精度差更影响体验

### pyannote 要不要 ONNX

也建议尽量 ONNX 化，原因和 Whisper 类似，但优先级次于 Whisper。

你现在可以直接参考：

- `onnx-community/pyannote-segmentation-3.0`

如果只是单条音频离线分析，其实你也可以先用 PyTorch 版；
但如果你想把它放进服务端常驻流程，还是 ONNX 更省心。

---

## 4. 我最推荐的两套组合

### 方案 A：最省事、最适合你当前项目

如果你继续使用“队友 ASR API + 自己 agent 编排”，那你只需要优先下载：

1. `papluca/xlm-roberta-base-language-detection`
2. `FireRedTeam/FireRedPunc` 或 `felflare/bert-restore-punctuation`
3. `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`
4. `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`

这套里：

- ASR 继续交给你队友
- 你自己的服务主要负责 transcript 后处理和融合分析
- 改造量最小

### 方案 B：全本地可演示版

如果你想让整个链条尽量自给自足，那就下载：

1. `openai/whisper-large-v3`
2. `pyannote/segmentation-3.0`
3. `papluca/xlm-roberta-base-language-detection`
4. `FireRedTeam/FireRedPunc`
5. `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`

这套更像完整的本地推理链，但依赖会更重；并且如果你是 CPU-only server，建议优先找它们的 ONNX 形态。

---

## 5. 下载命令模板

下面这些命令都符合你现在的目录挂载方式。

### 5.1 ASR 主模型：Whisper-large

更推荐你优先下标准版：

```bash
huggingface-cli download \
  openai/whisper-large-v3 \
  --local-dir services/agent/models/asr/openai__whisper-large-v3
```

如果你更在意吞吐和速度，再下 turbo：

```bash
huggingface-cli download \
  openai/whisper-large-v3-turbo \
  --local-dir services/agent/models/asr/openai__whisper-large-v3-turbo
```

英文轻量备选：

```bash
huggingface-cli download \
  distil-whisper/distil-large-v3 \
  --local-dir services/agent/models/asr/distil-whisper__distil-large-v3
```

### 5.2 CPU 版 Whisper ONNX

你说得对，`onnx-community/whisper-large-v3-turbo` 仓里有很多不同精度、不同导出形式的 ONNX 文件，没必要全下。

如果你当前目标是：

- 服务器只有 CPU
- 只做标准 ASR 推理
- 不做浏览器端 / Transformers.js 多版本兼容

那我建议你只保留“一套 int8 merged decoder 方案”。

最小必要文件可以理解成两类：

| 类别 | 需要的文件 |
| --- | --- |
| tokenizer / config | `config.json`, `generation_config.json`, `preprocessor_config.json`, `tokenizer.json`, `tokenizer_config.json`, `merges.txt`, `vocab.json`, `normalizer.json`, `added_tokens.json`, `special_tokens_map.json` |
| ONNX 权重 | `onnx/encoder_model_int8.onnx`, `onnx/decoder_model_merged_int8.onnx` |

也就是说，你当前不用下这些：

- `decoder_model.onnx`
- `decoder_with_past_model.onnx`
- `fp16`
- `q4`
- `q4f16`
- `bnb4`
- `uint8`
- `quantized`
- 其他重复变体

因为你现在只需要保留一套 CPU 用的 int8 主链就够了。

如果你准备直接按 CPU server 部署，我更建议你直接看这些 ONNX 仓：

```bash
huggingface-cli download \
  onnx-community/whisper-large-v3-turbo \
  --local-dir services/agent/models/asr/onnx-community__whisper-large-v3-turbo \
  --include "config.json" \
  --include "generation_config.json" \
  --include "preprocessor_config.json" \
  --include "tokenizer.json" \
  --include "tokenizer_config.json" \
  --include "merges.txt" \
  --include "vocab.json" \
  --include "normalizer.json" \
  --include "added_tokens.json" \
  --include "special_tokens_map.json" \
  --include "onnx/encoder_model_int8.onnx" \
  --include "onnx/decoder_model_merged_int8.onnx"
```

或者：

```bash
huggingface-cli download \
  onnx-community/whisper-large-v3-ONNX \
  --local-dir services/agent/models/asr/onnx-community__whisper-large-v3-ONNX \
  --include "config.json" \
  --include "generation_config.json" \
  --include "preprocessor_config.json" \
  --include "tokenizer.json" \
  --include "tokenizer_config.json" \
  --include "merges.txt" \
  --include "vocab.json" \
  --include "normalizer.json" \
  --include "added_tokens.json" \
  --include "special_tokens_map.json" \
  --include "onnx/encoder_model_int8.onnx" \
  --include "onnx/decoder_model_merged_int8.onnx"
```

如果你要更轻量一点的英文 CPU 版本：

```bash
huggingface-cli download \
  distil-whisper/distil-small.en \
  --local-dir services/agent/models/asr/distil-whisper__distil-small.en \
  --include "config.json" \
  --include "generation_config.json" \
  --include "preprocessor_config.json" \
  --include "tokenizer.json" \
  --include "tokenizer_config.json" \
  --include "merges.txt" \
  --include "vocab.json" \
  --include "normalizer.json" \
  --include "added_tokens.json" \
  --include "special_tokens_map.json" \
  --include "onnx/*"
```

注意，`distil-whisper/distil-small.en` 仓本身就带 `onnx/` 子目录。

如果你后面在代码里准备用“非 merged decoder”加载方式，那才需要改成下载：

- `onnx/decoder_model_int8.onnx`
- `onnx/decoder_with_past_model_int8.onnx`

但如果你还没写 loader，我建议你先按 merged 版本定下来，目录更简单。

### 5.3 VAD / segmentation

`pyannote/segmentation-3.0` 需要先在 Hugging Face 页面接受条件，再带 token 下载：

```bash
huggingface-cli download \
  pyannote/segmentation-3.0 \
  --token "$HF_TOKEN" \
  --local-dir services/agent/models/asr/pyannote__segmentation-3.0
```

### 5.4 VAD 的 ONNX 版本

如果你要直接上 CPU-friendly 版本，可以优先看：

```bash
huggingface-cli download \
  onnx-community/pyannote-segmentation-3.0 \
  --local-dir services/agent/models/asr/onnx-community__pyannote-segmentation-3.0
```

### 5.5 语言识别

```bash
huggingface-cli download \
  papluca/xlm-roberta-base-language-detection \
  --local-dir services/agent/models/papluca__xlm-roberta-base-language-detection
```

### 5.6 标点恢复

如果你要中英兼顾：

```bash
huggingface-cli download \
  FireRedTeam/FireRedPunc \
  --local-dir services/agent/models/FireRedTeam__FireRedPunc
```

如果你主要做英文：

```bash
huggingface-cli download \
  felflare/bert-restore-punctuation \
  --local-dir services/agent/models/felflare__bert-restore-punctuation
```

### 5.7 prosody / affect proxy

```bash
huggingface-cli download \
  audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim \
  --local-dir services/agent/models/audeering__wav2vec2-large-robust-12-ft-emotion-msp-dim
```

### 5.8 semantic embedding

```bash
huggingface-cli download \
  sentence-transformers/paraphrase-multilingual-mpnet-base-v2 \
  --local-dir services/agent/models/sentence-transformers__paraphrase-multilingual-mpnet-base-v2
```

---

## 6. 依赖分组建议

你前面说得对，`pyproject.toml` 不应该把这些都混到一个大组里。

如果后面你要正式接这些模型，我建议继续按下面拆：

| 组名建议 | 主要用途 | 典型依赖 |
| --- | --- | --- |
| `hf_asr` | Whisper 主 ASR | `transformers`, `torch`, `accelerate`, `sentencepiece` |
| `runtime` | 当前 agent 运行时（含内置 Whisper ONNX） | `onnxruntime`, `optimum`, `tokenizers` |
| `hf_vad` | pyannote VAD / segmentation | `pyannote.audio`, `torch`, `torchaudio` |
| `hf_vad_onnx` | pyannote CPU 部署 | `onnxruntime`, 对应 processor/runtime 包 |
| `hf_text_models` | 语言识别 / 标点恢复 / hedge 分类 | `transformers`, `torch` |
| `hf_embeddings` | SentenceTransformer embedding | `sentence-transformers`, `transformers`, `torch` |
| `hf_audio_traits` | prosody / affect proxy | `transformers`, `torch`, `librosa` 或等价音频依赖 |

现在已经统一收敛到 `runtime` 组，直接按 agent 当前主链安装即可。

---

## 7. 推荐落地顺序

如果你让我按工程收益排序，我建议你按下面顺序接：

1. 先接 `Whisper ONNX` 主链
2. 再接 `pyannote segmentation`，最好也是 ONNX 化
3. 再接 `papluca/xlm-roberta-base-language-detection`
4. 再接 `FireRedPunc` / `bert-restore-punctuation`
5. 再接 `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`
6. 最后才考虑 sentence embedding 和实验性 disfluency 模型

原因很简单：

- 前 2 步会先把你的 CPU 版 ASR 主链搭起来
- 第 3、4、5 步会继续改善 transcript 质量和 prosody 解释力
- 最后一类更像增强项，不是主链必需

---

## 8. 参考链接

- `openai/whisper-large-v3`: https://huggingface.co/openai/whisper-large-v3
- `openai/whisper-large-v3-turbo`: https://huggingface.co/openai/whisper-large-v3-turbo
- `distil-whisper/distil-large-v3`: https://huggingface.co/distil-whisper/distil-large-v3
- `distil-whisper/distil-small.en`: https://huggingface.co/distil-whisper/distil-small.en
- `onnx-community/whisper-large-v3-ONNX`: https://huggingface.co/onnx-community/whisper-large-v3-ONNX
- `onnx-community/whisper-large-v3-turbo`: https://huggingface.co/onnx-community/whisper-large-v3-turbo
- `pyannote/segmentation-3.0`: https://huggingface.co/pyannote/segmentation-3.0
- `onnx-community/pyannote-segmentation-3.0`: https://huggingface.co/onnx-community/pyannote-segmentation-3.0
- `pyannote/voice-activity-detection`: https://huggingface.co/pyannote/voice-activity-detection
- `papluca/xlm-roberta-base-language-detection`: https://huggingface.co/papluca/xlm-roberta-base-language-detection
- `FireRedTeam/FireRedPunc`: https://huggingface.co/FireRedTeam/FireRedPunc
- `felflare/bert-restore-punctuation`: https://huggingface.co/felflare/bert-restore-punctuation
- `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`: https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim
- `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`: https://huggingface.co/sentence-transformers/paraphrase-multilingual-mpnet-base-v2
- `ChrisLiewJY/BERTweet-Hedge`: https://huggingface.co/ChrisLiewJY/BERTweet-Hedge
- `pmootr/stuttering-detection-wavlm-lora`: https://huggingface.co/pmootr/stuttering-detection-wavlm-lora
- ONNX Runtime quantization docs: https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html
