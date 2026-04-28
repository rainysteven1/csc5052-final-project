# SpeakSure++ 推理结果 JSON 字段说明

本文档说明 `services/agent/cli.py analyze` 和 `analyze-samples` 导出的 JSON 结果里，每个 key 的含义、常见取值和推荐用法。

适用范围：

- `services/agent/data/analysis_outputs/*.json`
- `services/agent/data/demo_outputs/*.json`

更新时间：2026-04-24

---

## 1. 先看整体结构

当前单个推理结果 JSON 的顶层结构如下：

```json
{
  "request_id": "...",
  "status": "completed",
  "scenario": "presentation",
  "audio": {},
  "artifacts": {},
  "transcript": "...",
  "raw_asr_segments": [],
  "segments": [],
  "agent_outputs": {},
  "result": {},
  "warnings": [],
  "errors": [],
  "meta": {}
}
```

其中最常用的是这几块：

- `result`：最终汇总结果，展示页最优先读这里
- `segments`：逐句 / 逐段分析结果
- `agent_outputs`：各个 agent 的原始输出
- `warnings` / `errors`：运行告警和失败信息
- `meta`：运行过程附加信息，适合调试和追踪

---

## 2. 评分语义

在当前 `services/agent` 输出里，绝大多数 score 都遵循同一语义：

- 分数范围通常是 `0.0 ~ 1.0`
- `0` 表示当前维度没有检测到明显问题
- 分数越高，表示该维度的问题越明显
- 这不是“越高越好”的分数，而是“风险 / 问题强度”分数

### `result.level` 当前阈值

- `stable`：`overall_score == 0`
- `low`：`0 < overall_score < 0.35`
- `medium`：`0.35 <= overall_score < 0.65`
- `high`：`overall_score >= 0.65`

### `feedback.severity` 当前阈值

- `stable`
- `low`
- `medium`
- `high`

它的计算依据是单个 segment 上各维度分数和融合分数中的最大值，用于表示“这句最严重的问题等级”。

---

## 3. 顶层字段说明

| key | 类型 | 含义 | 常见取值 / 说明 |
| --- | --- | --- | --- |
| `request_id` | `string` | 本次分析请求 ID | 例如 `req_20260424T022009` |
| `status` | `string` | 整个任务最终状态 | `pending` / `running` / `completed` / `failed` |
| `scenario` | `string` | 当前分析场景 | 如 `interview` / `presentation` / `academic` |
| `audio` | `object` | 输入音频及预处理后的元信息 | 见下文 |
| `artifacts` | `object` | 本次推理使用的 artifact/provider 配置 | 见下文 |
| `transcript` | `string` | 最终采用的完整转写文本 | 可能来自 override / sidecar / manifest / stub |
| `raw_asr_segments` | `array` | ASR 直出的原始片段 | 当前最小版通常只有 1 条 |
| `segments` | `array` | 切分后的分析片段 | 每个片段带分数、高亮和反馈 |
| `agent_outputs` | `object` | 各 agent 的结构化输出 | 便于做调试或可视化 |
| `result` | `object` | 汇总分析结果 | 展示页优先读取 |
| `warnings` | `array[string]` | 告警信息 | 不一定失败，但表示有降级或数据异常 |
| `errors` | `array[string]` | 错误信息 | 一般失败时会出现 |
| `meta` | `object` | 运行过程附加信息 | 调试字段，扩展性强 |

---

## 4. `audio` 字段说明

```json
"audio": {
  "source_path": "...",
  "normalized_path": "...",
  "format": "flac",
  "duration_seconds": null,
  "duration_ms": null,
  "sample_rate": null,
  "channels": null,
  "file_size_bytes": 60652
}
```

| key | 类型 | 含义 |
| --- | --- | --- |
| `source_path` | `string` | 用户传入的原始音频路径 |
| `normalized_path` | `string` | 预处理后实际使用的音频路径；当前通常和 `source_path` 一样 |
| `format` | `string \| null` | 实际识别出的音频 container 格式，如 `wav` / `flac` |
| `duration_seconds` | `number \| null` | 音频时长，单位秒 |
| `duration_ms` | `number \| null` | 音频时长，单位毫秒 |
| `sample_rate` | `number \| null` | 采样率 |
| `channels` | `number \| null` | 声道数 |
| `file_size_bytes` | `number \| null` | 文件大小，字节数 |

补充说明：

- 当前只有真实 RIFF/WAV 容器时，才能稳定提取更完整的 WAV 元信息；
- 如果文件扩展名是 `.wav`，但文件头实际是 FLAC，那么 `format` 会写成 `flac`；
- 这种情况下 `duration_seconds` 等字段可能为 `null`，同时 `warnings` 里会出现对应说明。

---

## 5. `artifacts` 字段说明

```json
"artifacts": {
  "asr_model_version": "stub-asr-v1",
  "lexical_model_version": "rule-v1",
  "prosody_model_version": "rule-v1",
  "disfluency_model_version": "rule-v1",
  "config_version": "speaksure-runtime-v1",
  "fallback_mode": true,
  "providers": {},
  "paths": {}
}
```

| key | 类型 | 含义 |
| --- | --- | --- |
| `asr_model_version` | `string` | ASR 侧版本标识 |
| `lexical_model_version` | `string` | lexical 分析器版本标识 |
| `prosody_model_version` | `string` | prosody 分析器版本标识 |
| `disfluency_model_version` | `string` | disfluency 分析器版本标识 |
| `config_version` | `string` | 当前 `services/agent` 配置版本 |
| `fallback_mode` | `boolean` | 是否处于 fallback 模式；当前主要表示 ASR provider 不是正式在线模型 |
| `providers` | `object` | 各模块 provider 名称，如 `stub` / `rule` / `config` |
| `paths` | `object` | 本次运行里显式解析到的路径配置，例如 `transcription_manifest_path` |

注意：

- `providers.asr = "stub"` 不等于“这次 transcript 一定是 stub 生成的”；
- 它只表示当前没有接正式 live ASR artifact；
- 真正 transcript 的来源，以 `meta.asr_mode` 为准。

---

## 6. `transcript`、`raw_asr_segments`、`segments` 的区别

### `transcript`

- 整段最终采用的转写文本
- 是后续 segmentation 和分析的输入基础

### `raw_asr_segments`

- ASR 层直接产出的片段
- 当前最小版一般只有 1 条，表示“整段 transcript”
- 如果以后接入更真实 ASR，这里可能会出现多个细粒度时间片段

### `segments`

- 经过 segmentation 后得到的分析片段
- 是 UI / demo / 结果展示最应该使用的逐句结果
- 每条 segment 都带：
  - 文本
  - 时间范围
  - 分数
  - 高亮
  - feedback

---

## 7. 单个 `segment` 的字段含义

`raw_asr_segments`、`segments`、`result.segment_results` 里的元素结构基本一致：

```json
{
  "segment_id": "seg_001",
  "start": 0.0,
  "end": 0.0,
  "text": "...",
  "pause_before": 0.0,
  "token_count": 8,
  "scores": {},
  "highlights": [],
  "feedback": {}
}
```

| key | 类型 | 含义 |
| --- | --- | --- |
| `segment_id` | `string` | 片段 ID，如 `seg_001` |
| `start` | `number` | 片段开始时间，单位秒 |
| `end` | `number` | 片段结束时间，单位秒 |
| `text` | `string` | 该片段文本 |
| `pause_before` | `number \| null` | 该片段前的停顿时长 |
| `token_count` | `number` | 该片段粗粒度 token 数 |
| `scores` | `object` | 该片段各维度得分 |
| `highlights` | `array` | 该片段内的局部高亮信息 |
| `feedback` | `object` | 该片段的反馈建议 |

### `segment.scores`

| key | 含义 |
| --- | --- |
| `lexical` | 措辞不确定性分数 |
| `prosody` | 韵律问题分数 |
| `disfluency` | 流畅度问题分数 |
| `final` | 融合后的片段最终分数 |

### `segment.highlights`

用于标注片段内部的命中位置，常见字段：

| key | 含义 |
| --- | --- |
| `type` | 高亮类型，如 lexical trigger、disfluency issue 等 |
| `text` | 被高亮的文本 |
| `start_char` | 起始字符位置 |
| `end_char` | 结束字符位置 |

当前有些样本里可能为空数组，表示该片段没有命中的局部高亮。

### `segment.feedback`

| key | 含义 |
| --- | --- |
| `severity` | 该片段问题等级 |
| `focus_tags` | 这句优先关注的维度标签 |
| `reason` | 问题原因说明 |
| `rewrite` | 建议改写版本 |
| `practice` | 一句话练习建议 |
| `practice_steps` | 更适合 UI 展示的练习步骤列表 |

---

## 8. `agent_outputs` 字段说明

`agent_outputs` 保存的是各 agent 的“原始分析结果”，比 `result` 更细。

### 8.1 `agent_outputs.lexical`

每个元素对应一个 segment：

| key | 含义 |
| --- | --- |
| `segment_id` | 对应的 segment |
| `score` | lexical 风险分数 |
| `triggers` | 命中的弱承诺 / 模糊表达 |
| `explanations` | 解释文本 |

适合做：

- 展示“命中了哪些词”
- 高亮不确定表达

### 8.2 `agent_outputs.prosody`

| key | 含义 |
| --- | --- |
| `segment_id` | 对应的 segment |
| `score` | prosody 风险分数 |
| `features` | 轻量声学/节奏特征 |
| `explanations` | 对 prosody 问题的解释 |

当前 `features` 常见字段：

| key | 含义 |
| --- | --- |
| `speech_rate` | 语速 proxy |
| `pause_count` | 停顿次数 |
| `pause_duration` | 停顿时长 |
| `pitch_var` | 音高变化 proxy |
| `energy_var` | 能量变化 proxy |

注意：

- 这些是 runtime 轻量特征，不是完整声学模型输出；
- 某些极短音频或无完整时长信息的样本上，这些值更适合做 demo 解释，不适合作为严格科研指标。

### 8.3 `agent_outputs.disfluency`

| key | 含义 |
| --- | --- |
| `segment_id` | 对应的 segment |
| `score` | 流畅度问题分数 |
| `issues` | 检测到的问题列表 |
| `explanations` | 对问题的解释 |

其中 `issues` 的每一项：

| key | 含义 |
| --- | --- |
| `type` | 问题类型，如 filler / repetition / self-repair |
| `text` | 命中的文本 |
| `count` | 命中次数 |

### 8.4 `agent_outputs.context`

| key | 含义 |
| --- | --- |
| `scenario` | 当前场景 |
| `weights` | 当前场景使用的融合权重 |
| `style_constraints` | 当前场景的表达风格约束 |

说明：

- `weights` 决定 lexical / prosody / disfluency 在最终融合中的占比；
- 当前 `weights.context` 作为配置保留项存在，但还没有单独形成数值型 context score。

### 8.5 `agent_outputs.coaching`

这是融合后的中间汇总结果。

| key | 含义 |
| --- | --- |
| `overall_score` | 整体问题分数 |
| `level` | 整体等级 |
| `dominant_causes` | 主导问题来源 |
| `lexical_average` | lexical 平均分 |
| `prosody_average` | prosody 平均分 |
| `disfluency_average` | disfluency 平均分 |

### 8.6 `agent_outputs.feedback`

这是对 `segments[*].feedback` 的扁平化拷贝，便于前端直接按列表读取。

| key | 含义 |
| --- | --- |
| `segment_id` | 对应的 segment |
| `severity` | 问题等级 |
| `focus_tags` | 关注标签 |
| `problem` | 问题描述 |
| `rewrite` | 改写建议 |
| `practice` | 一句话练习建议 |
| `practice_steps` | 练习步骤列表 |

---

## 9. `result` 字段说明

`result` 是最适合做“最终结果展示”的区域。

```json
"result": {
  "status": "completed",
  "overall_score": 0.082,
  "level": "low",
  "dominant_causes": ["prosody"],
  "summary": "...",
  "segment_results": [],
  "generated_at": "2026-04-24T02:20:09.586186+00:00"
}
```

| key | 类型 | 含义 |
| --- | --- | --- |
| `status` | `string` | 最终结果状态，通常与顶层 `status` 一致 |
| `overall_score` | `number \| null` | 全局融合分数 |
| `level` | `string \| null` | 全局等级 |
| `dominant_causes` | `array[string]` | 主导问题维度 |
| `summary` | `string \| null` | 对本次分析的总结语 |
| `segment_results` | `array` | 最终版 segment 列表，通常和 `segments` 基本一致 |
| `generated_at` | `string` | 结果生成时间，ISO 8601 格式，当前使用 UTC |

### `dominant_causes` 当前可能值

- `lexical_uncertainty`
- `prosody`
- `disfluency`

### 为什么还有 `segment_results`

因为 `result` 是面向最终消费层的区域，所以把最终版 segment 一并复制进去，方便下游系统只读 `result` 也能拿到完整结果。

如果你自己写前端，二选一即可：

- 想直接展示最终结果：优先读 `result.segment_results`
- 想调试完整运行态：读顶层 `segments`

---

## 10. `warnings` 和 `errors`

### `warnings`

表示“任务还能跑完，但有降级或数据异常”。

常见例子：

- 没有 live ASR artifact，因此转去读 transcript override / sidecar / manifest / stub
- 非 WAV 文件当前只做 passthrough
- 文件后缀是 `.wav`，但真实 container 是 `flac`

### `errors`

表示“任务执行过程中真的出错了”。

常见特征：

- 顶层 `status` 可能会变成 `failed`
- `result.status` 也会是 `failed`
- 输出 JSON 仍可能被写出，但属于 partial result

---

## 11. `meta` 字段说明

`meta` 是调试和追踪字段，目前最常见的是：

| key | 含义 |
| --- | --- |
| `workflow_nodes` | 本次实际执行过的 workflow 节点顺序 |
| `preprocess_mode` | 预处理模式，如 `passthrough` |
| `asr_mode` | transcript 的真实来源 |
| `manifest` | 如果 transcript 来自 manifest，则这里保留 manifest 元信息 |
| `language` | 样本语言，如 `zh` / `en` |

### `meta.asr_mode` 当前可能值

| 值 | 含义 |
| --- | --- |
| `override` | 来自 `--transcript-file` |
| `sidecar` | 来自同名 `.txt` |
| `manifest` | 来自 `transcriptions.csv` |
| `stub` | 没有真实 transcript，只能用占位文本 |

### `meta.manifest`

当 `asr_mode = "manifest"` 时，通常会看到：

| key | 含义 |
| --- | --- |
| `manifest_path` | manifest 文件绝对路径 |
| `manifest_audio_path` | manifest 中记录的相对音频路径 |
| `language` | manifest 里的语言字段 |
| `split` | 数据切分，如 `train` / `dev` / `test` |
| `dataset_index` | 数据集样本编号 |
| `reference_text` | 参考文本 |
| `transcription_model` | 生成该 transcript 的模型名 |

说明：

- `meta` 适合调试、回溯和答辩展示；
- 但如果以后 schema 继续扩展，`meta` 是最可能增加字段的地方，所以前端不要把它写死得过于严格。

---

## 12. 前端 / 展示页推荐读取顺序

如果你后面要做页面，建议这样读：

### 最终结论卡片

优先读取：

- `scenario`
- `result.overall_score`
- `result.level`
- `result.dominant_causes`
- `result.summary`

### 逐句反馈卡片

优先读取：

- `result.segment_results[*].text`
- `result.segment_results[*].scores`
- `result.segment_results[*].feedback.reason`
- `result.segment_results[*].feedback.rewrite`
- `result.segment_results[*].feedback.practice_steps`

### 调试信息 / 技术说明

优先读取：

- `audio`
- `artifacts`
- `warnings`
- `errors`
- `meta.asr_mode`
- `meta.manifest`

---

## 13. 当前版本里哪些字段最稳定

如果你后面要继续接模型或接前端，建议把这些字段当成“第一优先稳定接口”：

- 顶层：
  - `request_id`
  - `status`
  - `scenario`
  - `transcript`
  - `warnings`
  - `errors`
- 汇总结果：
  - `result.overall_score`
  - `result.level`
  - `result.dominant_causes`
  - `result.summary`
  - `result.segment_results`
- 逐句结果：
  - `segment_id`
  - `text`
  - `scores`
  - `feedback`

相对更适合做“扩展字段”的是：

- `audio` 里的底层音频元信息
- `agent_outputs` 里的细节特征
- `meta` 里的运行轨迹和 manifest 附加信息

---

## 14. 一句话总结

如果只记一句：

- `result` 看最终结论
- `segments` / `result.segment_results` 看逐句问题
- `agent_outputs` 看各 agent 的原始依据
- `warnings/errors/meta` 看运行过程和调试信息
