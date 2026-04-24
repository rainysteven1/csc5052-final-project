# SpeakSure++ 推理层系统设计方案

## 1. 文档目标

本文档基于 `docs/SpeakSure++.pdf` 的需求说明，结合当前仓库现状，给出一份只覆盖 **推理层（services/agent inference layer）** 的 SpeakSure++ 系统设计方案。

这次设计明确做范围收敛：

- **我负责的范围**：音频输入、运行时编排、多维分析、融合推理、反馈生成、CLI/结果输出；
- **不纳入本次实现**：数据集整理、模型训练、微调、baseline/ablation 实验；
- **协作假设**：训练层由其他同学负责，并以“可加载模型 / 配置 / 词典 / 权重文件”的形式提供给推理层。

因此，本文档不再采用“训练层 + 推理层 + 展示层”的三层方案，而是直接聚焦一个可落地的、可交付的 **推理服务系统**。

本文档主要回答五个问题：

1. 这次推理层要解决什么问题；
2. 推理层与外部训练产物如何对接；
3. services/agent 模块如何拆分、数据如何流动；
4. 输出结果应该长什么样；
5. 接下来按什么顺序实现最稳。

---

## 2. 需求总结

SpeakSure++ 面向面试、演讲、学术汇报、商务沟通等场景，目标是识别说话者表达中的“不确定性”，并输出可解释、可执行的反馈。

### 2.1 输入

- 用户上传一段语音；
- 用户指定场景：`interview / presentation / academic / business / casual`；
- 系统接收音频文件与场景参数；
- 推理层可选接收外部模型路径、阈值配置、词典配置。

### 2.2 输出

- 总体不确定性评分；
- 片段级问题定位；
- 各维度分析结果：lexical / prosody / disfluency / context；
- 融合后的原因归纳；
- 改写建议与练习建议；
- 结构化 JSON 结果，供 CLI、UI 或报告模块复用。

### 2.3 推理层必须具备的核心能力

- 音频预处理；
- ASR 转写与时间戳对齐；
- 片段切分；
- 多维不确定性分析；
- 融合推理与解释生成；
- 反馈生成与统一结果导出。

---

## 3. 范围边界与协作假设

## 3.1 本次范围内

本次只做 `services/agent/` 为主的推理层，包括：

- 单条音频分析主链；
- 服务状态定义与工作流编排；
- 基础分析 agent 和融合逻辑；
- CLI 入口与结果文件输出；
- 与展示层对接所需的稳定 schema。

## 3.2 本次范围外

以下内容明确视为外部依赖或后续协作项，不在当前 owner 的主交付内：

- Whisper 微调；
- 文本分类器训练；
- 韵律模型训练；
- 融合权重学习；
- 数据标注、baseline、ablation、指标实验；
- 最终大而全的前端页面打磨。

## 3.3 与训练层的接口假设

训练层由其他同学完成后，推理层默认通过以下方式接入：

1. **模型文件**：如 ASR 模型、文本分类器、轻量打分模型；
2. **配置文件**：如场景权重、阈值、词典路径、特征归一化参数；
3. **推理契约**：输入字段、输出字段、版本号一致。

推理层不关心训练过程本身，只关心：

- 模型是否可以本地加载；
- 输入输出 schema 是否稳定；
- 失败时是否可以降级到规则版逻辑。

---

## 4. 当前仓库现状与设计原则

## 4.1 当前仓库现状

当前仓库已经有一套可复用的运行时骨架，但仍残留较多旧项目语义：

- `services/agent/` 已存在入口、配置、workflow、测试目录；
- `pyproject.toml` 与部分 docs 已转向 SpeakSure；
- 当前核心推理代码已经迁移到根目录 `services/agent/src/` 与 `services/asr/src/`；
- 当前最适合的策略是 **保留 `services/agent` 作为 CLI 壳子，把核心能力沉到根目录微服务目录**。

## 4.2 设计原则

1. **只聚焦推理主链**：优先保证 `audio -> analysis -> result` 能跑通；
2. **模型可插拔**：训练层产物由外部提供，推理层通过统一接口加载；
3. **规则可兜底**：即使外部模型暂未到位，也能先用规则版形成可演示闭环；
4. **结构化输出优先**：所有节点输出统一 schema，便于测试、UI 和回归；
5. **可解释优先于复杂度**：第一版不要追求最强模型，先保证可定位、可说明、可修改；
6. **离线单次分析优先**：第一版先做上传音频后分析，不追求实时流式。

---

## 5. 推理层总体架构

本次建议采用“一层主运行时 + 两类适配接口”的结构。

### 5.1 架构组成

#### A. Runtime Core（核心推理层）

负责整条分析主链：

- 音频预处理；
- ASR 与时间戳；
- 片段切分；
- 多维分析；
- 融合推理；
- 反馈生成；
- 结果对象汇总。

#### B. Artifact Adapter（模型/配置适配层）

负责把外部训练产物接进运行时：

- 模型加载；
- 词典和阈值配置加载；
- 不同版本模型的兼容包装；
- 模型不可用时回退到规则逻辑。

#### C. Output Adapter（输出适配层）

负责把 runtime 结果暴露给外部使用方：

- CLI 命令输出 JSON；
- 供后续 Streamlit/UI 读取；
- 供 demo 样例与回归测试固化。

### 5.2 端到端流程

```text
用户上传语音 + 选择场景
        |
        v
Audio Preprocess
        |
        v
ASR Agent
        |
        v
Segmentation Agent
        |
        v
Parallel Analysis
  |- Lexical Agent
  |- Prosody Agent
  |- Disfluency Agent
  |- Context Agent
        |
        v
Reasoning Agent
        |
        v
Feedback Agent
        |
        v
Result Serializer / CLI Output
```

### 5.3 为什么这样拆

- 训练层不在当前范围内，因此要把“模型怎么来”收敛到 adapter；
- 输出层暂不强绑前端，因此以 CLI + JSON 作为最稳定交付面；
- 多 agent 分析与融合逻辑仍保留，满足 PDF 对“可解释分析”的要求。

---

## 6. 运行时模块设计

## 6.1 Audio Preprocess

### 职责

- 接收 `wav/mp3/m4a` 等输入；
- 统一采样率、声道、响度范围；
- 生成供 ASR 与韵律分析复用的标准化音频；
- 记录音频元信息与缓存路径。

### 输入

- `audio_path`
- `scenario`

### 输出

```json
{
  "normalized_audio_path": "services/agent/data/cache/audio/req_001.wav",
  "duration_ms": 42310,
  "sample_rate": 16000,
  "channels": 1
}
```

### 设计要点

- 优先使用 `ffmpeg` 或同类稳定工具；
- 不支持格式时必须给清晰报错；
- 标准化结果允许缓存复用。

---

## 6.2 ASR Agent

### 职责

- 使用 Whisper 或外部提供的 ASR 推理封装进行转写；
- 输出 transcript 与带时间戳的 segments；
- 对重复分析提供缓存支持。

### 输入

- `normalized_audio_path`
- 可选 `asr_model_ref`

### 输出

```json
{
  "transcript": "I think maybe we can start from the dataset.",
  "segments": [
    {
      "segment_id": "asr_001",
      "start": 0.0,
      "end": 3.2,
      "text": "I think maybe we can start from the dataset."
    }
  ]
}
```

### 设计要点

- 第一版优先要稳定时间戳；
- 如果模型不可用，应允许切换到 stub / mock 以完成主链联调；
- 缓存命中策略应基于音频 hash + 模型版本。

---

## 6.3 Segmentation Agent

### 职责

- 将 ASR 输出切成适合分析的语义片段；
- 对齐片段时间范围；
- 生成稳定的 `segment_id`；
- 提供停顿相关辅助字段。

### 推荐切分策略

两阶段切分：

1. 先沿用 ASR 的原始 chunk；
2. 再结合标点、停顿长度、最大 token 长度做二次修正。

### 输出

```json
{
  "segments": [
    {
      "segment_id": "seg_001",
      "start": 0.0,
      "end": 3.2,
      "text": "I think maybe we can start from the dataset.",
      "pause_before": 0.8,
      "token_count": 9
    }
  ]
}
```

### 设计要点

- 下游 agent 统一消费 `segments`；
- 不追求完美句法切分，优先满足分析稳定性；
- segment 结构必须同时服务文本分析和音频分析。

---

## 6.4 Lexical Agent

### 职责

识别措辞层面的不确定性，回答“说了什么显得不够确定”。

### 分析重点

- 模糊词：`可能`、`也许`、`大概`；
- 弱承诺表达：`I think`、`maybe`、`probably`、`I guess`；
- 回避型表达：`try to`、`not sure`、`kind of`、`sort of`；
- 场景不匹配表达，如面试中过度保守措辞。

### 输出

```json
{
  "segment_id": "seg_001",
  "score": 0.74,
  "triggers": ["I think", "maybe"],
  "explanations": [
    "该句包含弱承诺表达，降低了陈述确定性"
  ]
}
```

### 推理策略

- 第一版：规则词典 + 模板解释；
- 第二步：接外部句子级分类器；
- 接入模型后，仍保留 trigger 证据，方便前端高亮。

---

## 6.5 Prosody Agent

### 职责

分析语音韵律，回答“怎么说显得不够稳定或不够自信”。

### 重点特征

- 语速；
- 停顿次数与停顿时长；
- 音高均值与波动范围；
- 能量变化与尾音稳定性；
- 节奏突变。

### 输出

```json
{
  "segment_id": "seg_001",
  "score": 0.68,
  "features": {
    "speech_rate": 2.6,
    "pause_count": 3,
    "pause_duration": 1.4,
    "pitch_var": 0.22,
    "energy_var": 0.19
  },
  "explanations": [
    "句前停顿偏长，语速后半段明显下降"
  ]
}
```

### 推理策略

- 第一版使用 `librosa` 等工具提特征后做规则评分；
- 外部若提供轻量 prosody 模型，则通过 adapter 替换 score 计算；
- 原始特征应保留下来，便于解释和调试。

---

## 6.6 Disfluency Agent

### 职责

检测流畅度问题，回答“语流是否卡顿、重复、自我修正过多”。

### 分析重点

- 填充词：`嗯`、`呃`、`那个`、`um`、`uh`；
- 重复：`I I`、短语重复；
- 自我修正：`不是...我的意思是...`；
- 异常停顿与不完整句。

### 输出

```json
{
  "segment_id": "seg_001",
  "score": 0.72,
  "issues": [
    {"type": "filler", "text": "um", "count": 2},
    {"type": "repeat", "text": "I I", "count": 1}
  ],
  "explanations": [
    "该片段出现填充词和重复，影响表达流畅性"
  ]
}
```

### 推理策略

- 文本侧识别 filler / repetition / repair；
- 音频侧可补充无文本长停顿信号；
- 与 Lexical Agent 分工明确：一个看措辞不确定，一个看语流不顺。

---

## 6.7 Context Agent

### 职责

根据场景调整阈值、权重和反馈风格，避免所有场景用同一套标准。

### 输入场景

- `interview`
- `presentation`
- `academic`
- `business`
- `casual`

### 输出

```json
{
  "scenario": "interview",
  "weights": {
    "lexical": 0.35,
    "prosody": 0.30,
    "disfluency": 0.20,
    "context": 0.15
  },
  "style_constraints": [
    "避免过多弱化表达",
    "建议回答更直接"
  ]
}
```

### 设计要点

- 上下文本身不一定直接打一个高分，而是提供融合调节项；
- 场景配置优先从 `config.toml` 或独立配置文件加载；
- 场景缺失时应回退到默认配置。

---

## 6.8 Reasoning Agent

### 职责

融合多 agent 输出，形成最终不确定性判断与原因归纳。

### 输入

- `lexical` / `prosody` / `disfluency` / `context` 输出；
- 片段文本与时间信息。

### 输出

```json
{
  "overall_score": 0.71,
  "level": "medium_high",
  "dominant_causes": ["lexical_uncertainty", "long_pauses"],
  "segment_results": [],
  "summary": "整体内容清晰，但在面试场景下措辞偏保守，且多个关键句前停顿较长。"
}
```

### 融合策略

第一版推荐两层结构：

1. **分数层**：显式权重或规则融合；
2. **解释层**：根据结构化证据组织 summary、cause 和排序。

公式可以保持简单：

```text
U = wL * L + wP * P + wD * D + wC * C
```

### 设计原则

- 分数必须可 review、可回归；
- 解释可以灵活，但必须引用已有证据；
- 不让黑盒文案生成直接决定底层分数。

---

## 6.9 Feedback Agent

### 职责

把分析结论转成用户真正能执行的建议。

### 输出层级

1. 总体反馈；
2. 片段级问题说明；
3. 改写建议；
4. 练习建议。

### 输出示例

```json
{
  "segment_id": "seg_001",
  "problem": "该句出现弱化表达和长停顿",
  "rewrite": "We can start from the dataset construction and then discuss the model design.",
  "practice": "请将该句用更短停顿重复朗读 3 次，并避免以 I think 开头。"
}
```

### 设计原则

- 反馈必须可执行，避免空泛评价；
- 每条反馈尽量对应具体片段；
- 模板化版本先落地，后续再增强语言自然度。

---

## 6.10 Result Serializer / CLI Adapter

### 职责

- 汇总运行时最终状态；
- 导出结构化 JSON；
- 提供 `analyze` 命令；
- 为 UI、demo、测试提供统一交付物。

### 推荐命令

```bash
python services/agent/cli.py analyze \
  --audio samples/interview_demo.wav \
  --scenario interview \
  --output out/interview_demo.json
```

### 设计原则

- CLI 先于 UI 成为主交付接口；
- 输出文件必须稳定、可回归、可直接 diff；
- 错误不得静默吞掉，应输出明确失败原因。

---

## 7. 统一数据结构设计

为降低模块耦合，整个推理层建议围绕一套 `AnalysisState` 传递。

## 7.1 顶层状态对象

```json
{
  "request_id": "req_20260424_001",
  "scenario": "interview",
  "audio": {
    "source_path": "samples/interview_demo.wav",
    "normalized_path": "services/agent/data/cache/audio/req_001.wav",
    "duration": 42.3,
    "sample_rate": 16000,
    "channels": 1
  },
  "artifacts": {
    "asr_model_version": "whisper-small",
    "lexical_model_version": "rule-v1",
    "prosody_model_version": "rule-v1"
  },
  "transcript": "...",
  "segments": [],
  "agent_outputs": {
    "lexical": [],
    "prosody": [],
    "disfluency": [],
    "context": {},
    "reasoning": {},
    "feedback": []
  },
  "result": {}
}
```

## 7.2 片段级结构

```json
{
  "segment_id": "seg_001",
  "start": 0.0,
  "end": 3.2,
  "text": "I think maybe this method is useful.",
  "pause_before": 0.8,
  "scores": {
    "lexical": 0.74,
    "prosody": 0.68,
    "disfluency": 0.72,
    "final": 0.71
  },
  "highlights": [
    {"type": "trigger", "text": "I think"},
    {"type": "trigger", "text": "maybe"}
  ],
  "feedback": {
    "reason": "措辞偏保守且句前停顿较长",
    "rewrite": "This method is useful for the first-stage analysis.",
    "practice": "去掉 I think 后再次朗读，并缩短句前停顿。"
  }
}
```

## 7.3 统一结构的价值

- workflow 状态清晰；
- 各 agent 可以独立测试；
- CLI 与 UI 共用同一结果合同；
- 结果回归更容易固化；
- 与训练层协作时接口边界更明确。

---

## 8. 与现有仓库结构的映射

本次不建议大改根目录，只聚焦 `services/agent/`。

## 8.1 推荐目标结构

```text
services/agent/
  main.py
  config.toml
  src/
    config.py
    runtime.py
    workflow.py
    state.py
    schemas/
      analysis.py
    services/
      artifact_loader.py
      audio_preprocess.py
      feature_extractor.py
      scorer.py
      result_serializer.py
    agents/
      asr_agent.py
      segmentation_agent.py
      lexical_agent.py
      prosody_agent.py
      disfluency_agent.py
      context_agent.py
      reasoning_agent.py
      feedback_agent.py
  tests/
```

## 8.2 迁移原则

- 保留现有 runtime 入口、配置、测试骨架；
- 把旧项目 workflow 和 agent 语义逐步替换；
- 不在本轮碰 `trainer/` 的设计与命名；
- 与推理无关的旧交易/新闻模块可以先标记为待替换，而不是一次删光。

---

## 9. Workflow 设计

如果继续使用 `langgraph` 或等价工作流编排，推荐使用“线性主链 + 并行分析分支”。

### 9.1 推荐流程

```text
START
  -> preprocess
  -> asr
  -> segment
  -> parallel_analysis
      |- lexical
      |- prosody
      |- disfluency
      |- context
  -> reasoning
  -> feedback
  -> serialize_result
  -> END
```

### 9.2 节点输入输出边界

- `preprocess`：写入标准化音频元信息；
- `asr`：写入 transcript 与原始 ASR segments；
- `segment`：写入分析用 segments；
- `lexical`：补齐每个 segment 的文本不确定性结果；
- `prosody`：补齐韵律特征与分数；
- `disfluency`：补齐流畅度问题；
- `context`：写入场景权重与风格约束；
- `reasoning`：产出总体分、主要原因、summary；
- `feedback`：补齐片段级反馈与总体建议；
- `serialize_result`：生成最终输出对象。

### 9.3 失败行为

- 任一核心节点失败时应保留错误上下文；
- 可选分析项失败时允许降级，但必须标记 `warnings`；
- 输出中应保留 `status`、`errors`、`artifact_versions` 便于定位问题。

---

## 10. 外部训练产物的接入方式

由于训练层由其他同学负责，推理层必须提前定义好接入契约。

## 10.1 建议接入对象

- `ASRModel`：输入音频，输出 transcript + timestamps；
- `LexicalScorer`：输入文本 segment，输出 score + evidence；
- `ProsodyScorer`：输入音频 segment 特征，输出 score + features；
- `FusionConfig`：提供场景级权重与阈值。

## 10.2 接入原则

1. **统一包装**：所有外部模型都通过 adapter 层暴露统一方法；
2. **版本显式化**：结果中记录使用了哪版模型/配置；
3. **不可用可降级**：模型缺失时允许回到规则版，但要显式标记；
4. **不要耦合训练代码**：runtime 只加载产物，不 import 训练过程脚本。

## 10.3 最低协作合同

训练层至少需要交付：

- 模型文件或可调用推理入口；
- 输入输出字段说明；
- 版本号；
- 依赖说明；
- 推理阈值或配置文件。

---

## 11. 非功能设计

## 11.1 性能目标

第一版不做实时，只要求：

- 1 到 3 分钟音频可在可接受时间内完成分析；
- 同一输入重复分析可复用缓存；
- 结果生成耗时与日志可追踪。

## 11.2 可维护性

- 每个 agent 输入输出清晰；
- 配置集中管理；
- 模型加载与 workflow 解耦；
- 结果 schema 稳定，可写单测与回归测试。

## 11.3 可解释性

- 每个总体分都能追溯到片段与证据；
- 尽量保留 trigger、pause、feature、issue 等中间证据；
- explanation 不得凭空生成。

## 11.4 可测试性

至少应覆盖：

- schema 校验；
- workflow 路径测试；
- agent 输出字段测试；
- demo 音频回归测试；
- 错误与降级路径测试。

---

## 12. 分阶段落地建议

围绕“只做推理层”的目标，建议按四阶段推进。

## 阶段 1：语义迁移与合同固化

目标：把 `services/agent/` 的旧语义切换成 SpeakSure++ 推理语义。

主要工作：

- 更新 runtime 相关文档；
- 定义 `AnalysisState` 与结果 schema；
- 重写 workflow 骨架；
- 明确 artifact adapter 接口。

交付结果：

- runtime 的主线已经不再依赖旧业务语义；
- 可以在 stub 节点下跑通整条状态流。

## 阶段 2：输入主链打通

目标：完成 `audio -> transcript -> segments`。

主要工作：

- 音频预处理；
- ASR 接入；
- segmentation；
- CLI analyze 原型。

交付结果：

- 给一段音频，系统能输出 transcript 和分析用 segments。

## 阶段 3：分析、融合与反馈闭环

目标：完成最小可用分析闭环。

主要工作：

- lexical / prosody / disfluency / context；
- reasoning 与 scorer；
- feedback 与结果序列化。

交付结果：

- 输出总体分、原因归纳、片段定位和建议。

## 阶段 4：回归与演示优化

目标：让推理层可稳定展示、可持续迭代。

主要工作：

- demo 样例固化；
- JSON 结果回归；
- 错误处理与日志优化；
- 视需要接 UI 或页面。

交付结果：

- 可以稳定跑 demo；
- UI 同学或后续自己接页面时无需重定 schema。

---

## 13. 主要风险与应对

## 风险 1：训练层产物晚到或接口不稳定

应对：

- 先实现 adapter 接口与规则版兜底；
- 所有外部模型走统一 wrapper；
- 结果中记录 artifact version，方便排查问题。

## 风险 2：ASR 误差放大下游问题

应对：

- 保留时间戳与原始片段信息；
- 对 prosody 和停顿问题尽量保留音频侧证据；
- 允许后续替换更好的 ASR 实现而不改下游 schema。

## 风险 3：解释很好看但分数不稳定

应对：

- 先锁定规则/显式权重作为分数来源；
- reasoning 只做归纳与排序，不直接拍脑袋给分；
- 建立 demo 回归样例。

## 风险 4：当前仓库旧代码太多，改动容易失控

应对：

- 优先替换入口与 workflow；
- 对旧模块先隔离、后替换；
- 先做一条最小推理主链，不做一次性大重构。

---

## 14. 结论

这次 SpeakSure++ 的系统设计，明确只围绕 **推理层** 展开。

核心目标不是把整套训练、实验、前端一次做完，而是先把下面这条主链稳定下来：

```text
音频输入 -> 预处理 -> ASR -> 切分 -> 多维分析 -> 融合推理 -> 反馈输出 -> JSON 结果
```

只要这条链路跑通，并且结果 schema 稳定、可解释、可测试，那么：

- 训练层同学可以持续替换更强模型；
- UI 层可以直接消费你的输出；
- 课程项目演示也会有一个明确、稳固的落点。
