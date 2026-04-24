# SpeakSure++ 推理层任务拆分清单与开发 Roadmap

本文档基于 `docs/SpeakSure++_系统设计方案.md` 继续细化，只围绕 **推理层** 做任务规划。

本次 Roadmap 明确收敛范围：

- **你当前负责**：`services/agent/` 推理主链、分析 agent、融合与反馈、CLI 和结果输出；
- **其他同学负责**：训练层、数据集、baseline/ablation、模型微调；
- **因此本份 todo 不再规划 trainer 相关工作**，只保留与推理层联调相关的接口事项。

核心目标只有一句话：

```text
尽快做出一条可运行、可解释、可导出结果的 SpeakSure++ 推理闭环
```

---

## 1. 本轮交付范围

## 1.1 In Scope

这次 Roadmap 覆盖以下内容：

- `services/agent` 语义迁移；
- `AnalysisState` 与结果 schema；
- workflow 重写；
- 音频预处理、ASR、segmentation；
- lexical / prosody / disfluency / context；
- reasoning / feedback / scorer；
- CLI analyze 命令；
- JSON 输出、回归样例、基础测试。

## 1.2 Out of Scope

以下内容不纳入你当前 todo：

- `trainer/` 重构；
- 训练命令设计；
- 数据标注规范编写；
- baseline / ablation / evaluation 脚本；
- 模型训练与导出；
- 大规模前端打磨。

## 1.3 与其他同学的协作接口

你需要关心的不是“怎么训练”，而是“训练产物怎么接”。

本轮至少要提前留好以下接口：

- 模型文件加载路径；
- 模型版本号记录；
- 词典 / 阈值 / 场景权重配置；
- 模型不可用时的降级逻辑；
- 结果 JSON 中的 artifact version 字段。

---

## 2. Roadmap 总览

建议把当前工作划分为 4 个阶段。

| 阶段 | 目标 | 核心产出 |
|---|---|---|
| Phase 0 | `services/agent` 语义迁移与合同固化 | 新 schema、新 workflow、新推理边界 |
| Phase 1 | 输入主链跑通 | `audio -> transcript -> segments` |
| Phase 2 | 分析与反馈闭环 | 多维分析、融合、反馈、CLI 结果 |
| Phase 3 | 稳定性与演示准备 | 回归样例、错误处理、demo 输出 |

推荐优先级：

1. 先完成 `Phase 0 + Phase 1`；
2. 再完成 `Phase 2`；
3. 最后补 `Phase 3`。

如果时间非常紧，最低可交付版本可以收敛为：

- 有一条完整 analyze 命令；
- 有 transcript 与 segment；
- 有 lexical / prosody / disfluency 三维结果；
- 有总体分和基础 feedback；
- 有一份稳定 JSON 输出。

---

## 3. 里程碑定义

### Milestone M1：services/agent 语义完成切换

**目标**：`services/agent/` 不再围绕旧项目逻辑，而是明确服务 SpeakSure++ 推理主链。

**达成标准**：

- `services/agent` 主流程命名已转成音频分析语义；
- `AnalysisState` 和结果 schema 已定义；
- workflow 拓扑改成 `preprocess -> asr -> segment -> analysis -> reasoning -> feedback`；
- 文档已明确“训练层不在当前 owner 范围内”。

### Milestone M2：输入主链可运行

**目标**：给一段音频后，系统能输出 transcript 和分析可用的 segments。

**达成标准**：

- 支持至少一种本地音频格式；
- 完成音频预处理；
- 完成 ASR 与时间戳输出；
- 完成 segmentation；
- CLI 能生成中间结果文件。

### Milestone M3：最小推理闭环完成

**目标**：系统可以输出分维度结果、总体分和反馈。

**达成标准**：

- lexical / prosody / disfluency 可运行；
- context 权重可接入；
- reasoning 能输出总体分和原因归纳；
- feedback 能输出至少一条改写建议和一条练习建议；
- 结果 JSON 可直接给 UI 或 demo 使用。

### Milestone M4：演示与回归可用

**目标**：推理层具备演示和持续迭代能力。

**达成标准**：

- 有固定 demo 输入；
- 有回归样例输出；
- 有错误与降级路径日志；
- 外部模型版本与配置版本被记录到结果中。

---

## 4. 按模块拆分任务

下面只按推理层实际需要拆任务：`docs`、`services/agent/`、`tests`、`demo assets`。

---

## 4.1 文档与合同任务

### T0-1 重写系统设计文档为“推理层版本”

- 删除训练层作为本次主设计对象；
- 明确 owner 范围、外部依赖与 artifact adapter；
- 定义 `services/agent` 目标结构、workflow 和结果 schema。

**交付物**：

- `docs/SpeakSure++_系统设计方案.md`

**验收标准**：

- 新同学看完后能明确：当前只做推理层，不负责训练层。

### T0-2 重写 todo / roadmap 为“推理层版本”

- 删除 trainer、数据、实验相关 todo；
- 改成面向 `services/agent` 闭环的阶段规划；
- 明确里程碑与优先级。

**交付物**：

- `docs/SpeakSure++_任务拆分清单与开发Roadmap.md`

### T0-3 定义 `services/agent` 统一 schema 合同

- 定义 `AnalysisState`；
- 定义 segment 结构；
- 定义 result JSON 顶层结构；
- 保留 artifact version 与 warning/error 字段。

**建议文件**：

- `services/agent/src/schemas/analysis.py`
- `services/agent/src/state.py`

**验收标准**：

- 所有 agent 的输入输出都能落在统一结构中。

---

## 4.2 Runtime 骨架与工作流任务

### T1-1 重写 workflow 骨架

- 从旧业务流程迁移到推理主链；
- 支持顺序主链与局部并行分析；
- 节点失败行为可见。

**建议节点**：

- `preprocess`
- `asr`
- `segment`
- `lexical`
- `prosody`
- `disfluency`
- `context`
- `reasoning`
- `feedback`
- `serialize_result`

**建议文件**：

- `services/agent/src/workflow.py`

**验收标准**：

- stub 节点下能完整跑通状态流；
- 旧 workflow 的核心入口不再是旧业务语义。

### T1-2 增加 artifact adapter

- 加载外部模型与配置；
- 统一包装调用接口；
- 模型缺失时回退到规则版。

**建议文件**：

- `services/agent/src/services/artifact_loader.py`

**验收标准**：

- runtime 不直接依赖训练代码；
- 可以显式记录当前加载的 artifact version。

### T1-3 定义结果序列化器

- 汇总最终状态；
- 生成稳定 JSON；
- 规范 warnings / errors / meta 字段。

**建议文件**：

- `services/agent/src/services/result_serializer.py`

**验收标准**：

- 同一输入在相同配置下输出结构稳定；
- UI 或 demo 可直接消费。

---

## 4.3 输入主链任务

### T2-1 实现 Audio Preprocess

- 音频标准化；
- 统一采样率到 16k；
- 单声道处理；
- 支持缓存标准化结果。

**建议文件**：

- `services/agent/src/services/audio_preprocess.py`

**验收标准**：

- 输入不同格式音频时可以产出统一格式；
- 失败时给清晰错误信息。

### T2-2 实现 ASR Agent

- 接入 Whisper 或外部 ASR artifact；
- 输出 transcript + 时间戳；
- 支持缓存复用。

**建议文件**：

- `services/asr/src/service.py`

**验收标准**：

- demo 音频可稳定输出 transcript；
- 时间戳结构满足后续 segmentation 使用。

### T2-3 实现 Segmentation Agent

- 基于 ASR chunk、标点和停顿做切分；
- 生成稳定 `segment_id`；
- 保留 `start/end/text/pause_before`。

**建议文件**：

- `services/agent/src/services/agent/nodes/segmentation_node.py`

**验收标准**：

- 不会严重切碎，也不会一整段过长；
- 结果可直接给 lexical / prosody / disfluency 消费。

### T2-4 提供 CLI analyze 原型

- 接受音频路径、场景、输出路径；
- 至少能跑到 segment-ready 结果；
- 输出 JSON 到本地文件。

**建议文件**：

- `services/agent/cli.py`

**验收标准**：

- 不依赖 UI，也能从命令行跑完整输入主链。

---

## 4.4 多维分析任务

### T3-1 实现 Lexical Agent

- 加载中英文不确定性词典；
- 实现规则触发与 score 计算；
- 输出 triggers 与 explanations。

**建议文件**：

- `services/agent/src/services/agent/nodes/lexical_node.py`

**验收标准**：

- 典型弱承诺表达能被识别；
- 句子级得分可用。

### T3-2 实现 Prosody Agent

- 提取语速、停顿、pitch、energy 特征；
- 先做规则版评分；
- 为后续外部模型替换留接口。

**建议文件**：

- `services/agent/src/services/agent/nodes/prosody_node.py`
- `services/agent/src/services/agent/tools/feature_extractor.py`

**验收标准**：

- demo 音频上能稳定输出数值；
- 特征范围合理。

### T3-3 实现 Disfluency Agent

- 检测 filler、repetition、自我修正；
- 结合停顿信号补充异常项；
- 输出 issue 列表。

**建议文件**：

- `services/agent/src/services/agent/nodes/disfluency_node.py`

**验收标准**：

- 对 `um / uh / 嗯 / 呃` 样例有明显响应；
- 能输出问题类型与位置。

### T3-4 实现 Context Agent

- 根据场景读取权重与风格约束；
- 为 reasoning 提供融合参数；
- 支持默认配置回退。

**建议文件**：

- `services/agent/src/services/agent/nodes/context_node.py`
- `services/agent/config/config.toml`

**验收标准**：

- 场景切换后，分数权重和反馈风格能变化。

---

## 4.5 融合与反馈任务

### T4-1 实现 scorer / 基础融合器

- 先做显式权重求和；
- 生成 overall score、level、dominant causes；
- 保证可回归。

**建议文件**：

- `services/agent/src/services/agent/tools/scorer.py`

**验收标准**：

- 相同输入输出稳定；
- 分数与原因逻辑一致。

### T4-2 实现 Reasoning Agent

- 汇总多 agent 证据；
- 生成 summary 和主要原因排序；
- 不直接黑盒决定底层分数。

**建议文件**：

- `services/agent/src/services/agent/nodes/reasoning_node.py`

**验收标准**：

- 总结文本能回指到具体证据；
- 输出可读，但不脱离结构化事实。

### T4-3 实现 Feedback Agent

- 基于问题类型生成反馈；
- 输出改写建议和练习建议；
- 第一版采用模板化生成。

**建议文件**：

- `services/agent/src/services/agent/nodes/feedback_node.py`

**验收标准**：

- 至少覆盖 lexical / prosody / disfluency 三类问题；
- 建议可执行，不空泛。

### T4-4 完成最终 JSON 结果合同

- 固定顶层字段；
- 固定 segment 细节结构；
- 固定 `warnings/errors/meta/artifacts` 字段。

**验收标准**：

- 后续 UI 接入不需要再改 schema；
- 回归测试可直接比较输出结构。

---

## 4.6 测试与回归任务

### T5-1 Schema 测试

- 测试 `AnalysisState` 构造；
- 测试 segment/result 结构合法性；
- 测试 artifact metadata 字段存在。

### T5-2 Workflow 测试

- 测试主链执行顺序；
- 测试节点失败行为；
- 测试降级路径是否可见。

### T5-3 Agent 单测

- lexical trigger 测试；
- filler / repetition 检测测试；
- prosody 特征范围测试；
- context 配置切换测试。

### T5-4 回归样例测试

- 给固定 demo 音频，输出结果保持基本稳定；
- 确保重构不会把 analyze 主链打崩。

### T5-5 CLI 结果合同测试

- 测试 `analyze` 命令是否生成预期文件；
- 测试错误时是否返回可读信息；
- 测试 warnings / meta 是否写入结果。

---

## 5. 按优先级排序的开发队列

如果你要真正开始做，推荐按下面顺序推进。

### P0：必须先做

1. 更新 `docs/SpeakSure++_系统设计方案.md`
2. 更新 `docs/SpeakSure++_任务拆分清单与开发Roadmap.md`
3. 定义 `AnalysisState` 与 result schema
4. 重写 `services/agent/src/workflow.py`
5. 增加 `artifact_loader.py`
6. 实现 `audio_preprocess.py`
7. 实现 `asr_agent.py`
8. 实现 `segmentation_agent.py`
9. 提供 `analyze` CLI 原型

### P1：主闭环核心能力

10. 实现 `lexical_agent.py`
11. 实现 `prosody_agent.py`
12. 实现 `disfluency_agent.py`
13. 实现 `context_agent.py`
14. 实现 `scorer.py`
15. 实现 `reasoning_agent.py`
16. 实现 `feedback_agent.py`
17. 固定最终 JSON 输出结构

### P2：稳定性与演示完善

18. 增加 schema / workflow / agent 单测
19. 固定 demo 音频与回归输出
20. 增加错误处理与降级日志
21. 补 `services/agent` README 或使用说明
22. 视需要对接 Streamlit / 页面

---

## 6. 任务依赖关系

### 核心依赖链

```text
文档收敛
  -> schema 定义
  -> workflow 重写
  -> artifact adapter
  -> preprocess
  -> ASR
  -> segmentation
  -> lexical/prosody/disfluency/context
  -> scorer/reasoning
  -> feedback
  -> result serializer / CLI
  -> regression fixtures
```

### 外部协作依赖

```text
训练层产物
  -> artifact loader 对接
  -> 替换规则版 scorer 或 agent 内部实现
  -> 保持 schema 不变
```

### 展示依赖

```text
runtime JSON 输出
  -> UI 渲染
  -> 高亮与片段播放
  -> demo 固化
```

---

## 7. 推荐时间安排

这里给你一个更贴近“只做推理层”的 4 周节奏。

## Week 1：合同与骨架周

**目标**：先把 runtime 的主线定义清楚。

任务：

- 改设计文档和 roadmap；
- 定义 `AnalysisState`；
- 重写 workflow 骨架；
- 设计 artifact adapter；
- 固定 result schema 草案。

**周末产出**：

- runtime 已经有明确推理拓扑；
- stub 数据可以跑通主流程。

## Week 2：输入链路周

**目标**：打通音频到 segment。

任务：

- `audio_preprocess.py`
- `asr_agent.py`
- `segmentation_agent.py`
- `main.py analyze` 原型

**周末产出**：

- 输入音频后能输出 transcript 和 segments。

## Week 3：分析闭环周

**目标**：完成核心分析和融合。

任务：

- `lexical_agent.py`
- `prosody_agent.py`
- `disfluency_agent.py`
- `context_agent.py`
- `scorer.py`
- `reasoning_agent.py`
- `feedback_agent.py`

**周末产出**：

- 有总体分、原因和建议；
- JSON 结果结构基本定版。

## Week 4：回归与演示周

**目标**：让结果稳定且能展示。

任务：

- schema / workflow / CLI 测试；
- demo 音频固化；
- 错误日志与 warnings；
- 如有余力，再接页面。

**周末产出**：

- 能稳定演示 analyze 流程；
- 后续接 UI 时不需要重新设计推理输出。

---

## 8. 每阶段交付检查表

## Phase 0 检查表

- [ ] 系统设计文档已改成推理层版本
- [ ] roadmap 已删除 trainer 相关 todo
- [ ] `AnalysisState` 已定义
- [ ] workflow 已切换到新流程
- [ ] artifact adapter 接口已明确

## Phase 1 检查表

- [ ] 音频预处理可运行
- [ ] ASR 可输出 transcript
- [ ] segmentation 可输出 segments
- [ ] `analyze` CLI 可跑
- [ ] 中间结果可导出为 JSON

## Phase 2 检查表

- [ ] lexical 分析可运行
- [ ] prosody 分析可运行
- [ ] disfluency 分析可运行
- [ ] context 权重已接入
- [ ] reasoning 已输出总体分与原因
- [ ] feedback 已输出改写建议

## Phase 3 检查表

- [ ] demo 音频已固定
- [ ] 回归样例已保存
- [ ] 错误与降级路径已可见
- [ ] artifact version 已写入结果
- [ ] UI 可直接消费输出 JSON

---

## 9. 建议创建的 Issue / Todo 列表

如果你准备按 issue 推进，建议先拆成下面这些：

1. `docs: rewrite SpeakSure++ system design for runtime-only scope`
2. `docs: rewrite roadmap for inference-layer delivery`
3. `runtime: define AnalysisState and result schema`
4. `runtime: rebuild workflow for speech uncertainty inference`
5. `runtime: add artifact loader for external model outputs`
6. `runtime: add audio preprocessing service`
7. `runtime: implement Whisper-based ASR agent`
8. `runtime: implement segmentation agent`
9. `runtime: implement lexical uncertainty agent`
10. `runtime: implement prosody analysis agent`
11. `runtime: implement disfluency detection agent`
12. `runtime: implement context config agent`
13. `runtime: implement scorer and reasoning agent`
14. `runtime: implement feedback generator and result serializer`
15. `runtime: add analyze CLI and result contract tests`
16. `runtime: add demo fixtures and regression outputs`

---

## 10. 当前最值得立即开始的三件事

### 第一件：先把 runtime 合同定住

优先做：

- `AnalysisState`
- result schema
- `workflow.py`
- `artifact_loader.py` 接口草案

原因：

- 这是所有实现的共同边界；
- 训练层、UI 层、测试都会依赖它；
- 一旦定下来，后续改动成本会明显降低。

### 第二件：先打通输入主链

优先做：

- `audio_preprocess.py`
- `asr_agent.py`
- `segmentation_agent.py`
- `main.py analyze`

原因：

- 没有 transcript 和 segments，后面所有分析都无从落地；
- 这是第一条可见结果最强的链路；
- 也是最容易尽快形成 demo 的部分。

### 第三件：先完成规则版分析闭环

优先做：

- `lexical_agent.py`
- `prosody_agent.py`
- `disfluency_agent.py`
- `context_agent.py`
- `scorer.py`
- `feedback_agent.py`

原因：

- 第一版不必等待训练层全部交付；
- 规则版最快能形成完整闭环；
- 后续替换成训练产物时，只要接口不变，整体架构不用推翻。

---

## 11. 结论

这份新的 Roadmap 只服务一个目标：

- **不再分散精力做训练层规划**；
- **集中把 SpeakSure++ 的推理闭环做出来**。

你现在最该推进的主链就是：

```text
audio -> preprocess -> ASR -> segmentation -> multi-agent analysis -> reasoning -> feedback -> result JSON
```

只要这条链路先稳定下来，你和其他同学的协作就会非常清楚：

- 他们负责不断提供更好的模型；
- 你负责把这些模型稳定接入，并产出可解释、可展示的运行时结果。
