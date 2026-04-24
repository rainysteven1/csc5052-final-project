# SpeakSure++ 推理层 Todo 模板

本文档基于 `docs/SpeakSure++_任务拆分清单与开发Roadmap.md` 细化而来，目的是把 roadmap 进一步转成一个可以直接打勾、直接分配、直接跟进的 todo 模版。

适用范围：

- `services/agent/` 推理主链开发；
- `services/agent` 文档、schema、workflow、agent、CLI、测试；
- 与外部训练产物对接时的接口跟进。

不适用范围：

- `trainer/` 重构；
- 数据标注与训练实验；
- baseline / ablation / evaluation；
- 大规模 UI 打磨。

---

## 1. 使用说明

推荐使用方式：

1. 先复制一份本文档，作为当前迭代 todo；
2. 给每个任务补充 `Owner / Status / Due / Dependency`；
3. 每完成一个可验证结果，就勾掉对应 checkbox；
4. 每周只关注当前 phase 的 `P0 + P1` 项，不要同时铺太开。

推荐状态：

- `todo`
- `doing`
- `blocked`
- `review`
- `done`

---

## 2. 迭代信息

- 迭代名称：
- 负责人：
- 开始日期：
- 目标截止日期：
- 当前 Phase：
- 当前重点：

---

## 3. 总看板

| 模块 | 负责人 | 优先级 | 状态 | 截止时间 | 备注 |
|---|---|---|---|---|---|
| Docs / Scope |  | P0 | todo |  |  |
| Schema / State |  | P0 | todo |  |  |
| Workflow |  | P0 | todo |  |  |
| Artifact Adapter |  | P0 | todo |  |  |
| Audio Preprocess |  | P0 | todo |  |  |
| ASR Agent |  | P0 | todo |  |  |
| Segmentation Agent |  | P0 | todo |  |  |
| CLI Analyze |  | P0 | todo |  |  |
| Lexical Agent |  | P1 | todo |  |  |
| Prosody Agent |  | P1 | todo |  |  |
| Disfluency Agent |  | P1 | todo |  |  |
| Context Agent |  | P1 | todo |  |  |
| Scorer / Reasoning |  | P1 | todo |  |  |
| Feedback / Serializer |  | P1 | todo |  |  |
| Tests / Regression |  | P2 | todo |  |  |
| Demo Fixtures |  | P2 | todo |  |  |

---

## 4. Phase 0：语义迁移与合同固化

目标：把  从旧项目语义切换成 SpeakSure++ 推理语义。

### 4.1 文档收敛

- [ ] 重写 `docs/SpeakSure++_系统设计方案.md`
  - Owner:
  - Status:
  - DoD: 明确只做推理层；训练层被定义为外部依赖；保留  架构、workflow、schema 说明。

- [ ] 重写 `docs/SpeakSure++_任务拆分清单与开发Roadmap.md`
  - Owner:
  - Status:
  - DoD: 删除 trainer / 数据 / 实验主任务；只保留  主链、分析、反馈、测试、演示相关任务。

- [ ] 补充本 todo 模版的当前迭代版本
  - Owner:
  - Status:
  - DoD: 当前迭代的 owner、状态、截止时间均已填写。

### 4.2 Schema 与状态合同

- [ ] 定义 `AnalysisState`
  - 建议文件：`services/agent/src/state.py`
  - Owner:
  - Status:
  - Dependency:
  - DoD: 包含 request、audio、scenario、transcript、segments、agent_outputs、result、warnings、errors。

- [ ] 定义统一分析 schema
  - 建议文件：`services/agent/src/schemas/analysis.py`
  - Owner:
  - Status:
  - Dependency:
  - DoD: segment、agent output、top-level result 都有明确字段和类型。

- [ ] 定义 artifact metadata 字段
  - Owner:
  - Status:
  - DoD: 结果中可记录模型版本、配置版本、降级模式、缓存命中状态。

### 4.3 Workflow 骨架

- [ ] 重写 `services/agent/src/workflow.py`
  - Owner:
  - Status:
  - Dependency: `AnalysisState`
  - DoD: workflow 明确为 `preprocess -> asr -> segment -> analysis -> reasoning -> feedback -> serialize_result`。

- [ ] 明确节点输入输出边界
  - Owner:
  - Status:
  - DoD: 每个节点消费哪些字段、产出哪些字段，都写进代码结构或注释/文档中。

- [ ] 定义失败与降级行为
  - Owner:
  - Status:
  - DoD: 核心失败可见；可选模块失败时写入 `warnings`；不会静默吞错。

### 4.4 Artifact Adapter

- [ ] 新增 artifact loader
  - 建议文件：`services/agent/src/services/artifact_loader.py`
  - Owner:
  - Status:
  - Dependency: schema 基本稳定
  - DoD: 可以统一加载外部模型、词典、阈值、权重文件。

- [ ] 定义模型不可用时的回退逻辑
  - Owner:
  - Status:
  - DoD: ASR、lexical、prosody 等模块在外部 artifact 缺失时可切回规则版或 stub。

### Phase 0 验收

- [ ] `services/agent` 主线命名已切换到 SpeakSure++ 语义
- [ ] `AnalysisState` 可用于后续所有 agent
- [ ] workflow stub 版本能跑通
- [ ] artifact adapter 接口已明确

---

## 5. Phase 1：输入主链跑通

目标：完成 `audio -> transcript -> segments`。

### 5.1 Audio Preprocess

- [ ] 实现音频标准化
  - 建议文件：`services/agent/src/services/audio_preprocess.py`
  - Owner:
  - Status:
  - Dependency: workflow 骨架
  - DoD: 支持至少一种本地音频格式，统一到目标采样率和单声道。

- [ ] 增加缓存策略
  - Owner:
  - Status:
  - DoD: 相同音频重复分析时可复用标准化结果。

- [ ] 增加失败提示
  - Owner:
  - Status:
  - DoD: 不支持格式、文件损坏、预处理失败时返回明确错误。

### 5.2 ASR Agent

- [ ] 实现 ASR 推理封装
  - 建议文件：`services/asr/src/service.py`
  - Owner:
  - Status:
  - Dependency: preprocess、artifact loader
  - DoD: 输出 transcript 与时间戳结构。

- [ ] 增加 ASR 缓存
  - Owner:
  - Status:
  - DoD: 按音频 hash + 模型版本复用结果。

- [ ] 支持 stub / mock 模式
  - Owner:
  - Status:
  - DoD: 外部模型未到位时仍能联调下游 workflow。

### 5.3 Segmentation Agent

- [ ] 实现 segment 切分逻辑
  - 建议文件：`services/agent/src/services/agent/nodes/segmentation_node.py`
  - Owner:
  - Status:
  - Dependency: ASR 输出结构
  - DoD: 基于时间戳、标点、停顿得到分析用片段。

- [ ] 生成稳定 `segment_id`
  - Owner:
  - Status:
  - DoD: 单次请求内唯一且可复现。

- [ ] 保留停顿相关字段
  - Owner:
  - Status:
  - DoD: 至少包含 `pause_before` 或等价字段，供 prosody / disfluency 使用。

### 5.4 CLI Analyze 原型

- [ ] 在 `services/agent/cli.py` 提供 `analyze` 命令
  - Owner:
  - Status:
  - Dependency: preprocess + ASR + segmentation
  - DoD: 支持 `--audio`、`--scenario`、`--output` 基本参数。

- [ ] 生成 segment-ready JSON
  - Owner:
  - Status:
  - DoD: 即使分析模块未全部完成，也能导出 transcript 和 segments。

### Phase 1 验收

- [ ] 给一段音频可以跑到 transcript
- [ ] 能得到结构化 segments
- [ ] CLI 可本地调用
- [ ] 输出文件结构可读、可调试

---

## 6. Phase 2：分析与反馈闭环

目标：完成多维分析、融合、反馈与结果输出。

### 6.1 Lexical Agent

- [ ] 接入中英文不确定性词典
  - 建议文件：`services/agent/src/services/agent/nodes/lexical_node.py`
  - Owner:
  - Status:
  - Dependency: segments
  - DoD: 至少支持常见 hedging / weak commitment / filler-like lexical patterns。

- [ ] 输出 `score + triggers + explanations`
  - Owner:
  - Status:
  - DoD: 结果可直接用于高亮和 reasoning。

### 6.2 Prosody Agent

- [ ] 实现特征提取
  - 建议文件：`services/agent/src/services/agent/tools/feature_extractor.py`
  - Owner:
  - Status:
  - Dependency: normalized audio + segments
  - DoD: 至少输出 speech rate、pause、pitch、energy 等基础特征。

- [ ] 实现规则版 prosody scoring
  - 建议文件：`services/agent/src/services/agent/nodes/prosody_node.py`
  - Owner:
  - Status:
  - DoD: 能输出 score 与特征解释。

### 6.3 Disfluency Agent

- [ ] 实现 filler 检测
  - 建议文件：`services/agent/src/services/agent/nodes/disfluency_node.py`
  - Owner:
  - Status:
  - Dependency: transcript / segments
  - DoD: 至少识别 `um / uh / 嗯 / 呃 / 那个`。

- [ ] 实现 repetition / repair 检测
  - Owner:
  - Status:
  - DoD: 可识别简单重复与自我修正模式。

- [ ] 输出 issue 列表
  - Owner:
  - Status:
  - DoD: 每类问题都带类型、文本或位置。

### 6.4 Context Agent

- [ ] 定义场景配置
  - 建议文件：`services/agent/config/config.toml`
  - Owner:
  - Status:
  - DoD: 至少支持 `interview / presentation / academic / business / casual`。

- [ ] 输出场景权重与风格约束
  - 建议文件：`services/agent/src/services/agent/nodes/context_node.py`
  - Owner:
  - Status:
  - DoD: reasoning 和 feedback 都能读取该配置。

### 6.5 Scorer / Reasoning

- [ ] 实现规则融合器
  - 建议文件：`services/agent/src/services/agent/tools/scorer.py`
  - Owner:
  - Status:
  - Dependency: lexical + prosody + disfluency + context
  - DoD: 生成 overall score、segment final score、level。

- [ ] 实现 Reasoning Agent
  - 建议文件：`services/agent/src/services/agent/nodes/reasoning_node.py`
  - Owner:
  - Status:
  - DoD: 总结 dominant causes、summary，且能回指结构化证据。

### 6.6 Feedback / Result Serializer

- [ ] 实现 Feedback Agent
  - 建议文件：`services/agent/src/services/agent/nodes/feedback_node.py`
  - Owner:
  - Status:
  - Dependency: reasoning 输出
  - DoD: 至少生成问题说明、改写建议、练习建议。

- [ ] 实现结果序列化器
  - 建议文件：`services/agent/src/services/result_serializer.py`
  - Owner:
  - Status:
  - DoD: 固定顶层 JSON 字段、segment 细节字段、meta/warnings/errors 字段。

- [ ] 打通 analyze 最终闭环
  - Owner:
  - Status:
  - DoD: 命令执行后可得到总体分、原因、片段反馈和 JSON 文件。

### Phase 2 验收

- [ ] lexical / prosody / disfluency 都能输出结果
- [ ] context 权重已接入
- [ ] overall score 和 dominant causes 已可用
- [ ] feedback 至少覆盖 3 类问题
- [ ] 最终 JSON 可以给 UI 直接消费

---

## 7. Phase 3：稳定性与演示准备

目标：让推理结果可回归、可演示、可协作。

### 7.1 Schema / Workflow / Agent 测试

- [ ] `AnalysisState` schema 测试
  - Owner:
  - Status:
  - DoD: 非法字段、缺失字段、默认值行为清晰。

- [ ] workflow 路径测试
  - Owner:
  - Status:
  - DoD: stub 下主流程可跑通，失败路径和降级路径可验证。

- [ ] agent 单测
  - Owner:
  - Status:
  - DoD: lexical、prosody、disfluency、context 至少各有基础测试。

### 7.2 CLI 与结果合同测试

- [ ] analyze 命令测试
  - Owner:
  - Status:
  - DoD: 参数正确时生成结果文件，参数错误时返回可读错误。

- [ ] result schema 回归测试
  - Owner:
  - Status:
  - DoD: 固定 demo 输入时，输出结构稳定不漂移。

### 7.3 Demo Fixtures

- [ ] 准备固定 demo 音频
  - Owner:
  - Status:
  - DoD: 至少 1 到 2 个可复用 demo 输入。

- [ ] 固定 demo 输出样例
  - Owner:
  - Status:
  - DoD: 保存一份期望结果，用于回归和展示。

- [ ] 补 `services/agent` 使用说明
  - Owner:
  - Status:
  - DoD: 别人可以按文档跑 `analyze` 命令并查看输出。

### 7.4 外部训练产物对接预留

- [ ] 记录 artifact version
  - Owner:
  - Status:
  - DoD: 结果文件中包含模型/配置版本信息。

- [ ] 验证规则版到模型版的可替换性
  - Owner:
  - Status:
  - DoD: 替换内部 scorer 或 agent 实现时，不需要改 result schema。

### Phase 3 验收

- [ ] 有固定 demo 输入输出
- [ ] 有 CLI 合同测试
- [ ] 有 schema / workflow / agent 测试
- [ ] 结果中有 artifact version 与 warnings/errors

---

## 8. 今日 / 本周执行区

### 今日 Todo

- [ ]
- [ ]
- [ ]

### 今日 Blocker

- [ ]
- [ ]

### 本周必须完成

- [ ]
- [ ]
- [ ]

### 本周可延后

- [ ]
- [ ]

---

## 9. 单任务卡片模板

下面这个模板适合给每个 `services/agent` 子任务单独复制一份。

### Task 名称

- Task:
- Priority: P0 / P1 / P2
- Status: todo / doing / blocked / review / done
- Owner:
- Reviewer:
- Due:
- Dependency:
- Related File:

### 目标

- 

### 输入

- 

### 输出

- 

### 验收标准

- [ ]
- [ ]
- [ ]

### 实现备注

- 

### Blocker

- 

---

## 10. 推荐先开工的 P0 清单

如果你准备今天就开始做，建议先从下面这组最小集合开始：

- [ ] `docs/SpeakSure++_系统设计方案.md`
- [ ] `docs/SpeakSure++_任务拆分清单与开发Roadmap.md`
- [ ] `services/agent/src/state.py`
- [ ] `services/agent/src/schemas/analysis.py`
- [ ] `services/agent/src/workflow.py`
- [ ] `services/agent/src/services/artifact_loader.py`
- [ ] `services/agent/src/services/audio_preprocess.py`
- [ ] `services/asr/src/service.py`
- [ ] `services/agent/src/services/agent/nodes/segmentation_node.py`
- [ ] `services/agent/cli.py` 的 `analyze` 命令

这组任务完成后，你的  主链就基本站住了，后续再补分析 agent、reasoning 和 feedback 会顺很多。
