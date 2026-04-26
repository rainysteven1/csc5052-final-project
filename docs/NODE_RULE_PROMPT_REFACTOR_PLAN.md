# SpeakSure++ Node / Rule / Prompt 重构方案

## 1. 文档目标

这份文档把三件事情合并到同一份方案里：

1. 后端 LangGraph 节点如何从当前的 11 个节点收敛为更合理的大节点。
2. 当前大量硬编码 rule 如何改造成可配置、可替换、可逐步 LLM 化的结构。
3. prompt 和 rule 都改成配置文件驱动，而不是继续 hard-code 在 Python 代码里。

这份文档的结论不是“只改前端展示”，而是：

- **后端节点也可以真实合并**
- **很多 rule 节点不应该继续直接给最终结论**
- **rule 更适合作为 evidence / feature 提取层**
- **LLM 更适合作为 judgment / explanation / feedback 层**
- **prompt 和 rule 都应该文件化配置，不继续硬编码**


## 2. 当前问题总结

### 2.1 当前 11 个节点过细

当前运行时暴露的节点是：

1. `prepare_input`
2. `asr`
3. `segment`
4. `lexical`
5. `prosody`
6. `disfluency`
7. `context`
8. `merge_analysis`
9. `reasoning`
10. `feedback`
11. `serialize_result`

这个拆法更像“工程实现图”，不是“业务推理图”。

对于前端 demo 来说，这会导致：

- pipeline 太长
- 卡片太多
- 很多 node 只是实现细节
- 用户看不懂哪些是真正重要阶段，哪些只是内部步骤


### 2.2 当前很多 rule 直接承担“最终裁判”

当前后端里，`lexical / prosody / disfluency / context` 这些环节，很多逻辑还是规则直接出最终结论。

这会带来几个问题：

- rule 覆盖面有限，容易漏判
- rule 在不同场景下不够鲁棒
- rule 的解释模板比较死
- 一旦要改判定标准，就要改代码

你担心的点是对的：

- **很多 rule 不一定对**
- **很多结论不应该由 rule 直接拍板**


### 2.3 当前 prompt 已部分配置化，但规则没有配置化

目前 `reasoning / feedback / json_repair` 已经走配置文件：

- `services/agent/config/config.toml`
- `services/agent/config/prompts/*.md`
- `services/agent/src/services/agent/tools/prompt_loader.py`

但以下内容还大量硬编码在 Python 里：

- lexical trigger rules
- disfluency regex patterns
- prosody threshold logic
- context 默认权重和风格约束

这就造成：

- prompt 可以改文件
- 但 rule 还得改代码

这不统一，也不利于实验和迭代。


## 3. 当前硬编码位置盘点

### 3.1 Lexical

当前文件：

- `services/agent/src/services/agent/nodes/lexical_node.py`

当前硬编码内容：

- `LEXICAL_RULES`
- phrase
- weight
- explanation

本质问题：

- 关键词词表硬编码
- 触发权重硬编码
- 解释文案硬编码


### 3.2 Disfluency

当前文件：

- `services/agent/src/services/agent/nodes/disfluency_node.py`

当前硬编码内容：

- `FILLER_PATTERNS`
- `SELF_REPAIR_PATTERNS`
- repetition scoring
- filler / repair explanation 文案

本质问题：

- pattern 硬编码
- score 逻辑硬编码
- explanation 文案硬编码


### 3.3 Prosody

当前文件：

- `services/agent/src/services/agent/nodes/prosody_node.py`

当前硬编码内容：

- speech rate 阈值
- pause duration 阈值
- energy variance 阈值
- pitch variance 阈值
- 各项分数增量
- explanation 文案

本质问题：

- prosody 的“阈值”和“解释策略”全部写死在代码里


### 3.4 Context

当前文件：

- `services/agent/src/services/agent/nodes/context_node.py`

当前硬编码内容：

- `DEFAULT_CONTEXTS`
- 每个 scenario 的默认 weights
- 每个 scenario 的默认 style_constraints

虽然 `config.toml` 已经支持外部配置覆盖，但代码里仍然保留一大块默认常量，仍然属于 hard-code。


### 3.5 Reasoning / Feedback

当前文件：

- `services/agent/src/services/agent/nodes/reasoning_node.py`
- `services/agent/src/services/agent/nodes/feedback_node.py`

这里已经比前面好很多，因为 prompt 已经外置：

- `services/agent/config/prompts/reasoning_system.md`
- `services/agent/config/prompts/reasoning_user.md`
- `services/agent/config/prompts/feedback_system.md`
- `services/agent/config/prompts/feedback_user.md`

但是后续如果要把 lexical / prosody / disfluency 也 LLM 化，就不能只配置 reasoning / feedback，必须把整套 prompt 体系扩展出去。


## 4. 推荐的后端节点重构方向

## 4.1 不建议继续保留 11 个物理节点

如果最终目标是：

- 更清晰的 pipeline
- 更自然的 agent 推理结构
- 更少的 UI 暴露复杂度

那么后端 LangGraph 也应当真实合并，而不是只在展示层合并。


## 4.2 推荐收敛为 4 个物理大节点

推荐改成下面这 4 个真实执行节点：

### Node A: `input`

内部包含：

- `prepare_input`
- `asr`
- `segment`

职责：

- 输入预处理
- transcript 获取
- 分句 / 分段


### Node B: `evidence`

内部包含：

- `lexical`
- `prosody`
- `disfluency`
- `context`
- `merge_analysis`

职责：

- 先做规则提取 / 特征提取
- 再整理为统一 evidence payload

关键点：

- 这个节点不一定直接给最终 judgment
- 它更像“证据生成器”


### Node C: `coaching`

内部包含：

- `reasoning`
- `feedback`

职责：

- 用 LLM 基于 evidence 做高层判断
- 生成总结、dominant causes、segment feedback、rewrite、practice steps

关键点：

- 这是 LLM 主导节点
- 可以是一轮 LLM，也可以两轮


### Node D: `finalize`

内部包含：

- `serialize_result`

职责：

- 结构封装
- 最终状态落盘
- JSON 导出


## 4.3 为什么推荐 4 个而不是 11 个

因为 4 个节点对应的是更自然的业务阶段：

1. 输入准备
2. 证据提取
3. 教练判断
4. 最终导出

而不是工程内部实现细节。


## 5. 不是“全改成 tool call”，而是“粗节点 + 内部函数”

这里要特别澄清：

你提到“很多 node 都只是调用模型或者基本规则逻辑，可以作为 tool_call 或封装函数，而不是单独 graph node”，这个方向是对的。

但不建议做成：

- 所有步骤都由 OpenAI agent 自主决定要不要调用哪些 tool

原因是：

- 这条链路不是开放式 agent 问题
- 它本质上是固定推理流水线
- `prosody / disfluency / segmentation / serialization` 这些不适合交给 agent 自主调度

所以更合理的结构是：

- **LangGraph 只保留少量粗节点**
- **粗节点内部调用多个普通 Python helper**
- **只有真正需要语言判断的地方交给 LLM**

换句话说：

- 不是“全链路 tool-calling”
- 而是“coarse-grained graph + internal function orchestration”


## 6. Rule 到 LLM 的重构原则

## 6.1 不建议纯 rule 继续直接出最终结论

推荐原则：

- **rule 负责提取证据**
- **LLM 负责判断和解释**

也就是：

- rule 从“裁判”退化成“证据采集器”
- LLM 才是最终的 judgment layer


## 6.2 不建议所有内容纯 LLM 化

因为有些环节天然应该 deterministic：

- `prepare_input`
- `asr`
- `serialize_result`
- prosody 数值特征提取
- segment 结构拆分

所以最合理的是 **hybrid**：

- deterministic extraction
- LLM-based interpretation


## 7. 各分析模块的推荐改法

## 7.1 Lexical：从 rule-based judgment 改成 evidence + LLM judgment

当前问题：

- 直接根据 trigger phrase 加权得分
- 解释文案固定
- rewrite 逻辑模板化

推荐改法：

### 保留 deterministic 部分

- trigger phrase 命中
- 命中 span
- 次数统计

### 交给 LLM 的部分

- 是否真的构成 lexical uncertainty
- 严重度
- 为什么影响表达效果
- 如何改写
- 练习建议

### 目标输出

- `score`
- `severity`
- `logic`
- `rewrite`
- `practice`

结论：

- lexical 适合从“纯 rule 节点”变成“evidence -> LLM 节点”


## 7.2 Disfluency：保留 pattern 检测，取消 rule 直出结论

当前问题：

- filler / repeat / self-repair pattern 是合理的
- 但这些 pattern 是否真的影响表达质量，不应完全靠硬编码 score

推荐改法：

### 保留 deterministic 部分

- filler 检测
- repeat 检测
- self-repair 检测
- start/end char span
- counts

### 交给 LLM 的部分

- 严重度判定
- 对表达质量的影响解释
- 是否需要在反馈中强调

结论：

- disfluency 不适合纯 LLM 从零发现问题
- 但适合“pattern extraction + LLM severity judgment”


## 7.3 Prosody：不要纯文本 LLM 化，要做 feature-to-LLM

当前问题：

- prosody 的阈值和说明完全硬编码
- 但 prosody 本身又不是纯文本能判断的

推荐改法：

### 必须保留 deterministic 部分

- speech_rate
- pause_duration
- energy_var
- pitch_var

这些是“测量”，不该交给 LLM。

### 交给 LLM 的部分

- 这些特征意味着什么
- 严重度如何
- 对当前 scenario 下表达效果有何影响
- 如何给出 coaching suggestion

结论：

- prosody 不能纯 LLM
- 应该做成 **feature extraction + LLM interpretation**


## 7.4 Context：从固定权重升级为“配置先验 + LLM 细化”

当前问题：

- scenario weights 和 style constraints 过于静态

推荐改法：

### 保留配置先验

- 每个 scenario 的基础 weights
- 每个 scenario 的基础 style constraints

### 交给 LLM 的部分

- 结合 transcript 和 evidence 动态补充 coaching focus
- 动态判断当前更应该强调 lexical / prosody / fluency 哪一块

结论：

- context 不建议全交给 LLM
- 更合理的是“config prior + LLM refinement”


## 7.5 Reasoning / Feedback：保留 LLM 主导，但统一并扩展配置化

当前状态：

- 这两个模块已经用配置文件驱动 prompt

推荐改法：

- 保留这条方向
- 后续如果 `coaching` 合并为一个大节点，需要把 prompt 也统一设计成新结构


## 8. 配置化设计原则

目标是：

- prompt 不写死在 Python 里
- rule 不写死在 Python 里
- provider 策略不写死在 Python 里
- 阈值、pattern、weights、schema 都可替换


## 8.1 推荐配置分层

建议拆成 3 层：

### A. runtime config

文件：

- `services/agent/config/config.toml`

职责：

- provider 选择
- 路径声明
- 全局默认策略


### B. prompt templates

目录：

- `services/agent/config/prompts/`

职责：

- system prompt
- user prompt
- json repair prompt
- structured output schema example


### C. rule / feature config

新目录建议：

- `services/agent/config/rules/`

职责：

- lexical triggers
- disfluency patterns
- prosody thresholds
- context priors
- scoring knobs


## 8.2 当前 prompt 配置化基础可以复用

当前已经存在：

- `services/agent/config/config.toml`
- `services/agent/src/services/agent/tools/prompt_loader.py`

这套机制已经证明可行。

所以推荐不要重新发明一套新机制，而是：

- 扩展当前 loader 思路
- 对 rule 也做一个 loader

例如新增：

- `rule_loader.py`
- `load_rule_config("lexical_rules")`
- `load_rule_config("disfluency_patterns")`


## 9. 推荐的配置文件结构

## 9.1 `config.toml` 新增 provider 和路径配置

推荐在 `services/agent/config/config.toml` 中扩展为：

```toml
[speaksure.runtime]
lexical_provider = "hybrid"
prosody_provider = "hybrid"
disfluency_provider = "hybrid"
context_provider = "hybrid"
coaching_provider = "llm"

[speaksure.rules]
lexical_rules = "rules/lexical_rules.yaml"
disfluency_rules = "rules/disfluency_rules.yaml"
prosody_rules = "rules/prosody_rules.toml"
context_defaults = "rules/context_defaults.toml"

[speaksure.prompts]
lexical_system = "prompts/lexical_system.md"
lexical_user = "prompts/lexical_user.md"
prosody_system = "prompts/prosody_system.md"
prosody_user = "prompts/prosody_user.md"
disfluency_system = "prompts/disfluency_system.md"
disfluency_user = "prompts/disfluency_user.md"
coaching_system = "prompts/coaching_system.md"
coaching_user = "prompts/coaching_user.md"
json_repair_system = "prompts/json_repair_system.md"
json_repair_user = "prompts/json_repair_user.md"
```


## 9.2 Lexical rule 文件建议

建议新建：

- `services/agent/config/rules/lexical_rules.yaml`

示例：

```yaml
rules:
  - phrase: "i think"
    weight: 0.24
    category: "weak_commitment"
    explanation: "出现弱承诺表达，陈述显得不够直接。"

  - phrase: "maybe"
    weight: 0.22
    category: "uncertainty"
    explanation: "出现模糊词，降低了表达确定性。"

  - phrase: "我觉得"
    weight: 0.24
    category: "weak_commitment"
    explanation: "出现主观弱承诺表达，显得不够直接。"
```

注意：

- 这里的 explanation 也不一定最终直接给用户
- 它更应该作为 evidence metadata 供 LLM 使用


## 9.3 Disfluency rule 文件建议

建议新建：

- `services/agent/config/rules/disfluency_rules.yaml`

示例：

```yaml
fillers:
  - label: "um"
    pattern: "\\bum\\b"
    weight: 0.12
  - label: "uh"
    pattern: "\\buh\\b"
    weight: 0.12
  - label: "嗯"
    pattern: "嗯+"
    weight: 0.12

self_repairs:
  - label: "i mean"
    pattern: "\\bi mean\\b"
    weight: 0.16
  - label: "不是"
    pattern: "不是"
    weight: 0.16

repetition:
  repeated_token_weight: 0.18
```


## 9.4 Prosody threshold 文件建议

建议新建：

- `services/agent/config/rules/prosody_rules.toml`

示例：

```toml
[speech_rate]
slow_threshold = 2.0
fast_threshold = 4.8
slow_penalty_cap = 0.35
fast_penalty_cap = 0.20

[pause]
long_pause_threshold = 0.5
penalty_cap = 0.25

[energy]
flat_threshold = 0.05
penalty = 0.12

[pitch]
flat_threshold = 0.01
penalty = 0.08
```


## 9.5 Context defaults 文件建议

建议新建：

- `services/agent/config/rules/context_defaults.toml`

把当前 `context_node.py` 里的默认常量迁走。

这样代码里不再保留庞大的 `DEFAULT_CONTEXTS`。


## 10. Prompt 配置化的下一步扩展

目前已经配置化的 prompt：

- reasoning
- feedback
- json repair

下一步建议再加：

- lexical
- prosody
- disfluency
- coaching（如果合并 reasoning + feedback）


## 10.1 新 prompt 目录建议

建议新增：

- `services/agent/config/prompts/lexical_system.md`
- `services/agent/config/prompts/lexical_user.md`
- `services/agent/config/prompts/disfluency_system.md`
- `services/agent/config/prompts/disfluency_user.md`
- `services/agent/config/prompts/prosody_system.md`
- `services/agent/config/prompts/prosody_user.md`
- `services/agent/config/prompts/coaching_system.md`
- `services/agent/config/prompts/coaching_user.md`


## 10.2 Prompt 设计原则

这些 prompt 不应该让 LLM“无中生有”，而应该要求它：

- 基于输入 evidence 判断
- 明确引用 features / triggers / issues
- 产出严格 JSON
- 避免自由发挥式长篇解释

也就是：

- **LLM based on evidence**
- 不是 **LLM from nothing**


## 11. 推荐的目标架构

最终推荐架构如下：

### Node 1: `input`

输入：

- audio
- transcript override

输出：

- normalized audio
- transcript
- segments


### Node 2: `evidence`

输入：

- transcript
- segments
- audio features
- rule configs
- context defaults

内部过程：

- lexical trigger extraction
- disfluency pattern extraction
- prosody feature extraction
- context prior loading
- merge evidence

输出：

- structured evidence bundle


### Node 3: `coaching`

输入：

- evidence bundle
- scenario
- prompts

内部过程：

- lexical / prosody / disfluency interpretation
- overall reasoning
- summary
- dominant causes
- feedback
- rewrite
- practice steps

输出：

- final coaching payload


### Node 4: `finalize`

输入：

- coaching payload
- evidence bundle

输出：

- final result JSON


## 12. 文件改造范围

## 12.1 后端工作流

主要修改：

- `services/agent/src/orchestration/graph_builder.py`

从当前 11 node graph 改成 4 node graph。


## 12.2 节点实现

建议新增大节点文件，例如：

- `services/agent/src/services/agent/nodes/input_node.py`
- `services/agent/src/services/agent/nodes/evidence_node.py`
- `services/agent/src/services/agent/nodes/coaching_node.py`
- `services/agent/src/services/agent/nodes/finalize_node.py`

旧的小节点可以逐步转成 helper：

- `lexical_node.py` -> lexical evidence helper
- `disfluency_node.py` -> disfluency evidence helper
- `prosody_node.py` -> prosody feature helper
- `context_node.py` -> context prior helper


## 12.3 配置加载

建议新增：

- `services/agent/src/services/agent/tools/rule_loader.py`

职责：

- 加载 lexical rules
- 加载 disfluency rules
- 加载 prosody thresholds
- 加载 context defaults


## 12.4 Prompt 加载

建议扩展：

- `services/agent/src/services/agent/tools/prompt_loader.py`

增加：

- lexical / prosody / disfluency / coaching prompt key


## 12.5 前端

后续要同步修改：

- `services/agent/frontend/src/types/analysis.ts`
- `services/agent/frontend/src/lib/analysis-helpers.ts`
- `services/agent/frontend/src/store/analysis-store.ts`
- `services/agent/frontend/src/components/pipeline/*`

从 11 node 视角改成 4 node 视角。


## 13. 渐进式迁移顺序

推荐按下面顺序做：

### 第一步：配置化 rule

先不动 graph。

先把这些硬编码迁出代码：

- lexical rules
- disfluency patterns
- prosody thresholds
- context defaults


### 第二步：扩展 prompt 配置体系

把 lexical / prosody / disfluency / coaching 的 prompt 也纳入配置体系。


### 第三步：把 rule 从“裁决层”改成“证据层”

让这些模块只输出：

- triggers
- issues
- features
- spans
- counts

不直接做最终 judgment。


### 第四步：增加 LLM judgment/coaching

在 `coaching` 节点里统一用 LLM 处理：

- severity
- logic
- summary
- dominant causes
- rewrite
- practice


### 第五步：LangGraph 从 11 节点收敛到 4 节点

最后再做 graph 物理合并。

这样风险最小。


## 14. 最终结论

这次重构最重要的不是单纯“把 node 数量变少”，而是同时完成两层升级：

### 升级一：执行结构升级

从：

- 11 个过细的工程节点

升级到：

- 4 个更符合业务阶段的大节点


### 升级二：分析逻辑升级

从：

- rule 直接出最终结论

升级到：

- rule 负责 evidence / features
- LLM 负责 judgment / explanation / feedback


### 升级三：配置体系升级

从：

- prompt 部分配置化
- rule 仍大量硬编码

升级到：

- prompt 文件化
- rule 文件化
- provider 可配置
- 阈值可配置
- schema 可配置


## 15. 建议的最终方向（一句话）

**把后端改成 4 个 coarse-grained LangGraph 节点，把 rule 下沉为可配置 evidence extractor，把 judgment 和 feedback 上移为 LLM + prompt 配置驱动。**

