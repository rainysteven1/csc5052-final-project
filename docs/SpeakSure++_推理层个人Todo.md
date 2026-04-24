# SpeakSure++ 推理层个人执行 Todo

本文档基于：

- `docs/SpeakSure++_系统设计方案.md`
- `docs/SpeakSure++_任务拆分清单与开发Roadmap.md`
- `docs/SpeakSure++_推理层Todo模板.md`

整理为一份 **单人直接执行版 todo**。默认场景是：当前项目只有你一个人推进，所以不再保留多人协作字段，直接按“已完成 / 当前做 / 下一步做”来管理。

更新时间：2026-04-24（已同步到当前实现）

---

## 1. 当前目标

当前只做一件事：

```text
先把 SpeakSure++ 推理主链做通：
audio -> preprocess -> ASR -> segmentation -> analysis -> reasoning -> feedback -> result JSON
```

本轮明确不做：

- `trainer/` 重构
- 数据标注
- baseline / ablation / evaluation
- 模型训练与微调
- 大规模 UI 打磨

---

## 2. 当前阶段判断

当前建议阶段：`Phase 1 -> Phase 2`

原因：

- P0 主链已经完成， 里旧新闻回测 agent 也已经清掉；
- 现在已经有可运行的规则版闭环，不再是“先搭骨架”的阶段；
- 接下来重点应转到结果质量、演示表现、README/文档同步和后续 artifact 接口增强。

---

## 3. 总状态看板

| 模块 | 优先级 | 当前状态 | 说明 |
|---|---|---|---|
| Docs / Scope | P0 | done | 文档已切到推理层范围 |
| Schema / State | P0 | done | `AnalysisState` 和 schema 已落地 |
| Workflow | P0 | done | 新 workflow 已切成 SpeakSure 推理主链 |
| Artifact Adapter | P0 | done | 已有 `artifact_loader.py` 和 fallback |
| Audio Preprocess | P0 | done | 已支持最小预处理与缓存目录 |
| ASR Agent | P0 | done | 已支持 sidecar transcript + stub fallback |
| Segmentation Agent | P0 | done | 已输出稳定 `segments` |
| CLI Analyze | P0 | done | `analyze` 已可运行 |
| Lexical Agent | P1 | done | 规则版已接入 |
| Prosody Agent | P1 | done | 轻量规则版已接入 |
| Disfluency Agent | P1 | done | 规则版已接入 |
| Context Agent | P1 | done | 已改成 `config.toml` 驱动 |
| Scorer / Reasoning | P1 | done | 已拆出 `scorer.py` |
| Feedback / Serializer | P1 | doing | 已可用，下一步继续增强建议粒度 |
| Tests / Regression | P2 | done | `services/agent/tests` 已通过，含 batch export CLI |
| Demo Fixtures | P2 | done | 已基于 samples 固化 20 份 demo JSON 和 summary |

---

## 4. 已完成

### 4.1 文档范围收敛

- [x] 重写 `docs/SpeakSure++_系统设计方案.md`
- [x] 重写 `docs/SpeakSure++_任务拆分清单与开发Roadmap.md`
- [x] 生成 `docs/SpeakSure++_推理层Todo模板.md`

### 4.2 当前结论已经明确

- [x] 只做推理层，不做训练层
- [x] 训练层视为外部 artifact 提供方
- [x] `services/agent` 主链已经明确
- [x] roadmap 已经改成个人可执行方向

### 4.3 当前已经落地的 `services/agent` 能力

- [x] `services/agent/cli.py` 已支持 SpeakSure++ `analyze` / `analyze-samples`
- [x] 旧新闻回测 / backtest agent 已从 `services/agent/` 删除
- [x] `services/agent/src/state.py` 已定义 `AnalysisState`
- [x] `services/agent/src/schemas/analysis.py` 已定义统一 schema
- [x] `services/agent/src/workflow.py` 已接入完整推理主链
- [x] `services/agent/src/services/artifact_loader.py` 已支持 service 配置读取
- [x] `services/agent/src/services/audio_preprocess.py` 已接入
- [x] `services/asr/src/service.py` 已接入
- [x] `services/agent/src/services/agent/nodes/segmentation_node.py` 已接入
- [x] `services/agent/src/services/agent/nodes/lexical_node.py` 已接入
- [x] `services/agent/src/services/agent/nodes/prosody_node.py` 已接入
- [x] `services/agent/src/services/agent/nodes/disfluency_node.py` 已接入
- [x] `services/agent/src/services/agent/nodes/context_node.py` 已接入
- [x] `services/agent/src/services/agent/tools/scorer.py` 已接入
- [x] `services/agent/README.md` 已改成 `services/agent` 说明
- [x] 当前 `services/agent/tests` 已通过
- [x] 已支持 `transcriptions.csv` manifest transcript 匹配
- [x] 已兼容 `.wav` 后缀但实际为 FLAC container 的英语样本
- [x] 已生成 `services/agent/data/demo_outputs/summary.md`

---

## 5. 现在立刻要做的重点

P0 已经完成，当前重点改成“收尾增强 + 演示准备”。

### 当前重点 1：继续增强 feedback

- [ ] 让 feedback 输出更细
  - 目标：
    - 增加更适合演示的建议字段
    - 区分问题严重程度
    - 给出更清晰的练习步骤

### 当前重点 2：固化 demo fixture

- [x] 直接使用 `services/agent/data/samples/audio/` 作为正式 demo 输入
- [x] 使用 `services/agent/data/samples/transcriptions.csv` 作为 transcript manifest
- [x] 已批量导出 20 份 `presentation` demo JSON
- [x] 已生成 `services/agent/data/demo_outputs/summary.md`

### 当前重点 3：为后续真实模型接入留接口

- [ ] 明确 ASR artifact 的接入方式
- [ ] 明确 lexical / prosody model artifact 的 provider 接口
- [ ] 保证替换规则版实现时不需要改 result schema

### 当前重点 4：同步文档与 todo

- [x] 把个人 todo 和实际进度持续同步
- [x] 保持 `README`、docs 和代码能力一致

### 当前完成标准

- [x] `analyze` 已可跑
- [x] 三维分析已可用
- [x] README 已同步
- [x] demo fixture 已固定
- [ ] feedback 更适合演示

---

## 6. P1：主闭环分析任务

P0 做完以后，马上接这组。

### P1-1 已完成项

- [x] `services/agent/src/services/agent/nodes/lexical_node.py`
- [x] `services/agent/src/services/agent/tools/feature_extractor.py`
- [x] `services/agent/src/services/agent/nodes/prosody_node.py`
- [x] `services/agent/src/services/agent/nodes/disfluency_node.py`
- [x] `services/agent/src/services/agent/nodes/context_node.py`
- [x] `services/agent/src/services/agent/tools/scorer.py`
- [x] `services/agent/src/services/result_serializer.py`

### P1-2 当前还值得继续优化的点

- [ ] 把 feedback 做得更细
- [ ] 给 reasoning 增加更适合演示的总结语
- [ ] 给 ASR 留更真实 artifact provider 接口
- [x] 准备正式 demo 输入输出

### P1 完成标准

- [x] lexical / prosody / disfluency 都能输出结果
- [x] context 已接入权重
- [x] overall score 可用
- [x] dominant causes 可用
- [x] feedback 已包含改写建议和练习建议
- [ ] feedback 输出进一步增强

---

## 7. P2：稳定性与演示

这部分不要现在就展开，等主链跑通后再补。

### P2-1 测试

- [x] `AnalysisState` schema 测试
- [x] workflow 路径测试
- [x] lexical 单测
- [x] prosody 单测
- [x] disfluency 单测
- [x] CLI 结果合同测试

### P2-2 回归样例

- [x] 准备固定 demo 音频
- [x] 固定 demo 输出 JSON
- [x] 生成 `summary.md` 作为回归查看基线

### P2-3 使用说明

- [x] 更新 `services/agent/README.md`
- [x] 写清楚 `analyze` 命令怎么跑
- [x] 写清楚输出文件怎么看

---

## 8. 今天就按这个顺序做

如果你现在马上开始编码，今天建议优先做下面 5 件事：

- [ ] 1. 增强 `feedback` 字段与建议粒度
- [x] 2. 固定一套正式 demo 输入
- [x] 3. 固定 demo 输出 JSON
- [ ] 4. 补一个“真实模型接入占位”的 provider 接口
- [x] 5. 保持 README / docs / todo 同步

今天不要做的事：

- [ ] 不要先改 UI
- [ ] 不要先碰 trainer
- [ ] 不要先追求复杂模型
- [ ] 不要一上来写太多 feature engineering

---

## 9. 本周执行清单

### 必须完成

- [ ] feedback 增强
- [x] demo fixture
- [x] demo JSON 基线
- [ ] artifact provider 接口草案

### 完成了算超额

- [ ] 更真实的 ASR 接入 stub
- [ ] 面向答辩的截图 / 演示脚本

---

## 10. 单任务记录模板

后面你每做一个任务，就按这个格式简单记录，够用了。

### Task

- 名称：
- 文件：
- 优先级：P0 / P1 / P2
- 状态：todo / doing / blocked / done
- 依赖：

### 要做到什么

- 

### 验收标准

- [ ]
- [ ]

### 备注

- 

---

## 11. 最后提醒

你现在最应该坚持的一条原则是：

```text
先把已经跑通的主链打磨成“可展示、可解释、可继续接模型”的版本。
```

所以接下来不要分散，直接按这个顺序推进：

```text
feedback 增强 -> demo fixture -> artifact 接口 -> 演示文档 -> 再接真实模型
```

只要这条链先站住，后面的训练层对接、UI 展示、演示答辩都会顺很多。
