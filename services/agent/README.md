# SpeakSure++ Agent Service

`services/agent/` 现在是 SpeakSure++ 的推理层服务目录，当前重点是跑通一条可演示、可导出结果的本地分析主链，而不是训练层。

当前已经可用的主链：

```text
audio -> preprocess -> ASR -> segmentation -> lexical -> prosody -> disfluency -> context -> judgment -> coaching -> result JSON
```

## 当前范围

这层当前负责：

- 本地 `analyze` CLI
- 音频输入与最小预处理
- transcript 获取
- segment 切分
- lexical / prosody / disfluency 三维分析
- context 场景权重配置
- judgment 融合、coaching 合成与反馈输出
- MiniMax LLM 增强的 summary / feedback
- 可选 W&B 结果上传
- JSON 结果导出

当前不负责：

- 模型训练
- baseline / ablation / evaluation
- 数据标注
- 大规模 UI 打磨

## 目录说明

- `cli.py`：薄 CLI 壳子，只负责启动 `services/agent` 内部应用
- `services/agent/src/app/cli_service.py`：Typer CLI 实现，包含 `analyze` 和 `analyze-samples`
- `services/agent/config/config.toml`：Agent 服务配置，包含 `speaksure.contexts.*` 场景权重
- `services/agent/config/prompts/`：运行时 LLM prompt 文档模板，`judgment` / `coaching` / `feedback` 都从这里加载
- `services/agent/src/state.py`：`AnalysisState`
- `services/agent/src/schemas/analysis.py`：统一 schema
- `services/agent/src/workflow.py`：对外工作流入口，保持 CLI / 测试调用稳定
- `services/agent/src/orchestration/`：编排层，拆分为 orchestrator 与 LangGraph graph builder
- `services/agent/src/asr/`：Agent 内部 ASR runtime，包含 transcript 获取、远程 ASR client 和本地 ONNX backend
- `services/agent/src/backend/`：Agent 后端执行层，内部再拆分 `nodes/`、`tools/`、`contracts/`，包含 segmentation、lexical、prosody、disfluency、context、judgment、coaching、feedback
- `services/agent/src/services/`：Agent 服务内部公共层，包含 artifact loader、音频预处理、结果序列化等
- `tests/`：服务侧单测与主链测试
- `services/agent/data/analysis_outputs/`：默认 JSON 输出目录
- `services/agent/data/demo_outputs/`：样本集批量导出结果和 `summary.md`
- `services/agent/data/samples/`：当前 demo 输入样本目录，属于外部输入数据，不强制绑定到服务内部

## 依赖安装

当前依赖由 `services/agent/pyproject.toml` 统一管理，只保留当前 agent 需要的三组：

- `runtime`：Agent 主运行时，包含 CLI、gRPC 和内置 ONNX ASR
- `proto`：proto 代码生成
- `dev`：测试和 lint

本地开发推荐直接同步：

```bash
cd services/agent
uv sync --group runtime --group dev --group proto
```

开始前建议先准备环境变量文件：

```bash
just init-env
```

`.env.example` 里已经列出了：

- Agent / ASR transport 切换变量
- ASR backend 切换变量
- MiniMax 变量
- W&B 变量
- Hugging Face 下载 token

也可以先看一眼当前启动配置：

```bash
just doctor
```

如果你想持续看本地健康状态和端口连通性：

```bash
just doctor-live
just doctor-live 1
```

## 直接运行

先看帮助：

```bash
python services/agent/cli.py --help
python services/agent/cli.py analyze --help
python services/agent/cli.py analyze-samples --help
```

最小运行方式：

```bash
python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario interview
```

指定输出路径：

```bash
python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario presentation \
  --output services/agent/data/analysis_outputs/demo.presentation.json
```

显式指定 transcript 文件：

```bash
python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario interview \
  --transcript-file path/to/demo.txt
```

批量导出样本集：

```bash
python services/agent/cli.py analyze-samples \
  --audio-dir services/agent/data/samples/audio \
  --manifest services/agent/data/samples/transcriptions.csv \
  --scenario presentation \
  --output-dir services/agent/data/demo_outputs \
  --summary-file services/agent/data/demo_outputs/summary.md
```

上传单次分析结果到 W&B：

```bash
python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario interview \
  --upload-wandb
```

上传批量样本结果到 W&B：

```bash
python services/agent/cli.py analyze-samples \
  --audio-dir services/agent/data/samples/audio \
  --manifest services/agent/data/samples/transcriptions.csv \
  --scenario presentation \
  --upload-wandb
```

## Transcript 获取规则

当前 transcript 获取优先级：

1. `--transcript-file`
2. 音频同名 sidecar `.txt`
3. 样本目录里的 `transcriptions.csv`
4. 上游 ASR provider
5. stub transcript

常见样本布局：

- `services/agent/data/samples/audio/*.wav`
- `services/agent/data/samples/transcriptions.csv`

匹配 manifest 后会：

- 使用 `transcription` 作为 transcript
- 把 manifest 元信息写入 `state.meta.manifest`
- 把 `language` 写入 `state.meta`

补充：

- `artifacts.providers.asr = "stub"` 只表示没有接正式在线 ASR artifact
- 如果存在 transcript override / sidecar / manifest，运行时会优先使用这些真实文本
- `en_test_*.wav` 这批样本里有文件扩展名是 `.wav`、实际容器是 FLAC；运行时会按文件头识别，避免 demo 数据报错

字段说明文档：

- `docs/SpeakSure++_推理结果JSON字段说明.md`

## LLM / API / W&B 环境变量

### MiniMax LLM

```bash
export MINIMAX_API_KEY=...
export MINIMAX_BASE_URL=...
export SPEAKSURE_LLM_MODEL=MiniMax-M2.7
```

### Prompt 模板

`judgment` / `coaching` / `feedback` 不再把 prompt 固定写死在节点代码里，默认改为从下面这些文档读取：

- `services/agent/config/prompts/judgment_system.md`
- `services/agent/config/prompts/judgment_user.md`
- `services/agent/config/prompts/coaching_system.md`
- `services/agent/config/prompts/coaching_user.md`
- `services/agent/config/prompts/feedback_system.md`
- `services/agent/config/prompts/feedback_user.md`
- `services/agent/config/prompts/json_repair_system.md`
- `services/agent/config/prompts/json_repair_user.md`
- `services/agent/config/prompts/schemas/judgment_result.json`
- `services/agent/config/prompts/schemas/coaching_result.json`
- `services/agent/config/prompts/schemas/feedback_segments_result.json`

默认路径在 `services/agent/config/config.toml` 里配置：

```toml
[speaksure.prompts]
judgment_system = "prompts/judgment_system.md"
judgment_user = "prompts/judgment_user.md"
coaching_system = "prompts/coaching_system.md"
coaching_user = "prompts/coaching_user.md"
feedback_system = "prompts/feedback_system.md"
feedback_user = "prompts/feedback_user.md"
json_repair_system = "prompts/json_repair_system.md"
json_repair_user = "prompts/json_repair_user.md"
judgment_repair_schema = "prompts/schemas/judgment_result.json"
coaching_repair_schema = "prompts/schemas/coaching_result.json"
feedback_repair_schema = "prompts/schemas/feedback_segments_result.json"
```

这些路径默认相对于 `config.toml` 所在目录解析，所以你可以直接把 system prompt 按文档格式写在这些 `.md` 文件里，而不是改 Python 代码。
当上游 LLM 返回的 JSON 解析失败时，运行时会再走一轮 `json_repair_*` prompt，并读取对应的 `*_repair_schema` JSON 示例，把原始输出重整成合法 JSON。

如果你想确认“这次实际发给模型的 prompt 到底是什么”，可以先开：

```bash
export SPEAKSURE_DEBUG_PROMPTS=1
```

开启后，导出的结果 JSON 里会带上 `meta.llm_prompts`，包含渲染后的 system/user prompt 和模板路径，方便直接排查 prompt 是否生效。

### gRPC 微服务

共享 proto 已经上提到：

- `services/proto/speaksure/v1/common.proto`
- `services/proto/speaksure/v1/asr_service.proto`
- `services/proto/speaksure/v1/agent_service.proto`

重新生成 Python stub（输出到 `services/agent/gen/`）：

```bash
./services/agent/scripts/generate_proto.sh
```

如需显式指定 Python，可直接：

```bash
PYTHON_BIN=python3.11 ./services/agent/scripts/generate_proto.sh
```

启动服务：

```bash
just proto-gen
just run-agent-grpc
just run-backend
```

现在默认推荐的方式是直接启动面向前端的 Go backend；它会调用 `services/agent`，而 `services/agent` 默认在进程内直接使用内部 ASR runtime：

```bash
just run-backend
```

如果你想显式切换 Agent engine 的 ASR 传输模式，可以直接给 gRPC engine 入口传参数：

```bash
just run-agent-grpc local
just run-agent-grpc grpc
```

这里的含义是：

- `local`：Agent 直接在内存中调用 `services/agent/src/asr/`，不经过内部 gRPC
- `grpc`：Agent 调用配置里的外部 gRPC ASR endpoint

ASR runtime 仍然区分两层：

- transport：`local` / `grpc` / `api` / `stub`
- backend：`onnx` / `stub` / `grpc`

backend 本身建议放在 `services/agent/config/config.toml` 固定管理；
平时通过 `just` 动态切换的只有 `SPEAKSURE_ASR_PROVIDER`。

默认 bind 可以直接在 `services/agent/config/config.toml` 里统一配置：

```toml
[speaksure.runtime]
agent_grpc_bind = "127.0.0.1:50051"
```

在 `services/agent/config/config.toml` 里切到 gRPC ASR：

```toml
[speaksure.runtime]
asr_provider = "grpc"
asr_grpc_target = "127.0.0.1:50052"
```

如果你想让 Agent 直接在本进程内走单体 ASR：

```toml
[speaksure.runtime]
asr_provider = "local"
```

如果你想单独控制 Agent 内部 ASR runtime 的 backend：

```toml
[speaksure.runtime]
asr_backend = "onnx"
# asr_backend = "stub"
# asr_backend = "grpc"
# asr_backend_grpc_target = "127.0.0.1:50052"
# asr_onnx_model_dir = "services/agent/models/asr/onnx-community__whisper-large-v3-turbo"
```

另外，目前建议只有这一个环境变量用于运行时快速切换：

- `SPEAKSURE_ASR_PROVIDER`

其他这些更稳定的值，建议统一写在 `services/agent/config/config.toml`：

- `asr_backend`
- `asr_backend_grpc_target`
- `asr_onnx_model_dir`
- `asr_grpc_target`
- `agent_grpc_bind`

如果你希望 CLI 也不再本地直调 agent，而是通过 gRPC 请求 `services/agent`，再加上：

```toml
[speaksure.runtime]
agent_grpc_target = "127.0.0.1:50051"
```

这样：

- `services/agent/cli.py analyze ...` 会变成 gRPC client；
- `services/agent/main.py` 是真正处理分析请求的 server；
- `services/agent` 内部直接调用自己的 ASR runtime。

gRPC 服务额外暴露了：

- gRPC Health Checking
- gRPC Server Reflection

也就是本地联调时可以直接用标准 gRPC tooling 做探活和列服务，而不用再额外写临时诊断接口。

`AgentService.Analyze` 除了完整 `result_json`，还返回结构化 `digest`：

- `request_id`
- `scenario`
- `transcript`
- `generated_at`
- `language`
- `asr_mode`
- `workflow_engine`
- `artifacts`

这样 CLI / UI / 其他 service 读取摘要字段时，不必强依赖整份 JSON 反序列化。

### Go Backend API

面向前端和演示环境的产品 API 现在统一以 Go backend 为准：

```bash
just run-backend
```

Go backend 对外提供 REST + SSE 产品接口；`services/agent` 本身现在只保留 gRPC engine。

推荐链路：

- 浏览器 / Web 前端请求 Go backend HTTP API；
- Go backend 通过 Python bridge 调用 `services/agent`；
- `services/agent` 内部默认直接调用本地 ASR runtime。

### Live Frontend

前端目录：

- `services/frontend/`

它支持：

- 上传音频
- 创建分析任务
- 通过 SSE 看当前跑到哪个 node
- 实时查看每个 node 的 payload
- 节点专属可视化卡片
- 从本机结果 JSON 做静态回放
- 回放模式的播放 / 暂停 / 步进控制
- 渲染最终结果 JSON

本地联调方式：

先启动 Go backend：

```bash
cd /root/private_data/workspace/csc5052-final-project
just run-backend
```

再启动前端：

```bash
cd /root/private_data/workspace/csc5052-final-project
just run-frontend
```

默认前端地址：

- `http://127.0.0.1:5173`

### 外部 ASR API

在 `services/agent/config/config.toml` 里设置：

```toml
[speaksure.runtime]
asr_provider = "api"
asr_api_url = "http://127.0.0.1:8000/transcribe"
```

### W&B

```bash
export WANDB_API_KEY=...
export WANDB_MODE=online
```

## 支持的场景

在 `services/agent/config/config.toml` 里已经配置：

- `interview`
- `presentation`
- `academic`
- `business`
- `casual`

每个场景当前包含：

- `weights`
  - `lexical`
  - `prosody`
  - `disfluency`
  - `context`
- `style_constraints`

如果传入未知场景，会自动回退到默认 context 配置。

## 分析能力

### Lexical

主要检测弱承诺 / 模糊表达，输出 `score`、`triggers`、`explanations` 和 segment highlights。

### Prosody

当前是轻量规则版，主要用 `speech_rate`、`pause_count`、`pause_duration`、`energy_var`、`pitch_var`。

说明：

- `pitch_var` 是轻量 proxy，不是严格声学 pitch tracker
- 目标是先支撑当前融合链路和演示

### Disfluency

当前会检测 filler、repetition、self-repair，输出 `score`、`issues`、`explanations` 和 segment highlights。

## 输出文件说明

默认输出路径：

```text
services/agent/data/analysis_outputs/{audio_stem}.{scenario}.json
```

批量导出样本集时，默认会额外生成：

```text
services/agent/data/demo_outputs/summary.md
```

结果文件包含：

- 顶层请求信息
- `audio`
- `artifacts`
- `transcript`
- `segments`
- `agent_outputs`
  - `lexical`
  - `prosody`
  - `disfluency`
  - `context`
  - `judgment`
  - `coaching`
  - `feedback`
- `result`
- `warnings`
- `errors`
- `meta`

核心字段示例：

```json
{
  "scenario": "interview",
  "transcript": "I think maybe we can start now.",
  "result": {
    "status": "completed",
    "overall_score": 0.42,
    "level": "medium",
    "dominant_causes": [
      "lexical_uncertainty",
      "disfluency"
    ],
    "summary": "检测到多维度问题，部分片段在措辞、韵律或流畅度上都存在改进空间。"
  }
}
```

## 当前限制

当前版本仍然是最小闭环，主要边界：

- 非 `.wav` 音频目前只做 passthrough，不做真正重采样转换；
- 没有接入正式 ASR 模型时，依赖 transcript override / sidecar / manifest / stub；
- prosody 还是轻量特征方案，不是完整声学模型；
- feedback 已可用，但仍偏模板化；
- 已经不再保留旧的新闻回测 / backtest agent 主线。

## 测试

当前可以直接跑整套 `services/agent` 推理测试：

```bash
PYTHONPATH=. python -m pytest services/agent/tests -q
```

如果只想跑轻量 CPU / no-model 测试：

```bash
PYTHONPATH=. python -m pytest services/agent/tests -q -m "not onnx and not hf_model"
```

CI 默认就是这条轻量测试路径，不会安装或执行：

- ONNX / Whisper 运行时依赖
- Hugging Face 大模型下载
- 其他重资源模型测试
- `grpcio-tools` 这类只在 proto 生成时需要的开发依赖

后续如果新增重测试，请显式打 marker：

- `@pytest.mark.onnx`
- `@pytest.mark.hf_model`

本地脚本也支持两种模式：

```bash
./scripts/check_agent.sh
AGENT_CHECK_PROFILE=ci ./scripts/check_agent.sh
```

脚本会在启动时打印当前 profile 和 pytest marker 过滤条件，方便在 CI 日志里快速确认到底跑的是轻量集还是全量集。

代码风格检查：

```bash
cd services/agent && UV_CACHE_DIR=../../.cache/uvtmp uv run ruff check \
  cli.py \
  main.py \
  backend_bridge.py \
  bootstrap.py \
  src \
  tests
```

Current architecture reference:

- `docs/CURRENT_ARCHITECTURE.md`
