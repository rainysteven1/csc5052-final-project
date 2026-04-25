# SpeakSure++ Agent Service

`services/agent/` 现在是 SpeakSure++ 的推理层服务目录，当前重点是跑通一条可演示、可导出结果的本地分析主链，而不是训练层。

当前已经可用的主链：

```text
audio -> preprocess -> ASR -> segmentation -> lexical -> prosody -> disfluency -> context -> reasoning -> feedback -> result JSON
```

## 当前范围

这层当前负责：

- 本地 `analyze` CLI
- 音频输入与最小预处理
- transcript 获取
- segment 切分
- lexical / prosody / disfluency 三维分析
- context 场景权重配置
- reasoning 融合与 feedback 输出
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
- `services/agent/config/prompts/`：运行时 LLM prompt 文档模板，`reasoning` / `feedback` 都从这里加载
- `services/agent/src/state.py`：`AnalysisState`
- `services/agent/src/schemas/analysis.py`：统一 schema
- `services/agent/src/workflow.py`：对外工作流入口，保持 CLI / 测试调用稳定
- `services/agent/src/orchestration/`：编排层，拆分为 orchestrator 与 LangGraph graph builder
- `services/asr/src/`：ASR 微服务实现，包含 transcript 获取和远程 ASR client
- `services/agent/src/services/agent/`：Agent 编排层，内部再拆分 `nodes/`、`tools/`、`contracts/`，包含 segmentation、lexical、prosody、disfluency、context、reasoning、feedback
- `services/agent/src/services/`：Agent 服务内部公共层，包含 artifact loader、音频预处理、结果序列化等
- `tests/`：服务侧单测与主链测试
- `services/agent/data/analysis_outputs/`：默认 JSON 输出目录
- `services/agent/data/demo_outputs/`：样本集批量导出结果和 `summary.md`
- `services/agent/data/samples/`：当前 demo 输入样本目录，属于外部输入数据，不强制绑定到服务内部

## 依赖安装

当前 `pyproject.toml` 已按服务用途拆成更细的 group：

- `agent_grpc`：Agent gRPC / CLI 主链
- `agent_http`：Agent HTTP transport
- `asr_runtime`：ASR gRPC 服务
- `proto`：proto 代码生成
- `dev`：测试和 lint

本地开发推荐直接同步这一组：

```bash
just sync-dev
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
./.venv/bin/python services/agent/cli.py --help
./.venv/bin/python services/agent/cli.py analyze --help
./.venv/bin/python services/agent/cli.py analyze-samples --help
```

最小运行方式：

```bash
./.venv/bin/python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario interview
```

指定输出路径：

```bash
./.venv/bin/python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario presentation \
  --output services/agent/data/analysis_outputs/demo.presentation.json
```

显式指定 transcript 文件：

```bash
./.venv/bin/python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario interview \
  --transcript-file path/to/demo.txt
```

批量导出样本集：

```bash
./.venv/bin/python services/agent/cli.py analyze-samples \
  --audio-dir services/agent/data/samples/audio \
  --manifest services/agent/data/samples/transcriptions.csv \
  --scenario presentation \
  --output-dir services/agent/data/demo_outputs \
  --summary-file services/agent/data/demo_outputs/summary.md
```

上传单次分析结果到 W&B：

```bash
./.venv/bin/python services/agent/cli.py analyze \
  --audio path/to/demo.wav \
  --scenario interview \
  --upload-wandb
```

上传批量样本结果到 W&B：

```bash
./.venv/bin/python services/agent/cli.py analyze-samples \
  --audio-dir services/agent/data/samples/audio \
  --manifest services/agent/data/samples/transcriptions.csv \
  --scenario presentation \
  --upload-wandb
```

## Transcript 获取规则

当前 ASR 层是“可运行优先”的本地方案，优先级如下：

1. 如果传了 `--transcript-file`，直接使用该文件内容；
2. 否则，如果音频旁边存在同名 `.txt` 文件，就自动读取；
3. 否则，如果音频上级样本目录里存在 `transcriptions.csv`，会按 `audio_path` 匹配对应 transcript；
4. 否则，回退到 stub transcript，并在结果里写入 warning。

例如：

- `samples/interview_demo.wav`
- `samples/interview_demo.txt`

如果两者同目录同名，运行 `analyze --audio samples/interview_demo.wav` 时会自动读取这个 sidecar transcript。

当前也支持你现在这种 manifest 形式的数据：

- `services/agent/data/samples/audio/*.wav`
- `services/agent/data/samples/transcriptions.csv`

其中 `transcriptions.csv` 至少会读取这些字段：

- `audio_path`
- `language`
- `split`
- `dataset_index`
- `reference_text`
- `transcription`
- `model`

匹配成功后，`services/agent` 会：

- 用 `transcription` 作为 transcript
- 在 `state.meta.manifest` 里保留 manifest 元信息
- 把 `language` 写入 `state.meta`

如果你要单独查看导出 JSON 里每个字段的解释，可以直接看：

- `docs/SpeakSure++_推理结果JSON字段说明.md`

补充说明：

- `artifacts.providers.asr = "stub"` 只表示“没有接正式在线 ASR artifact”；
- 如果存在 transcript override / sidecar / manifest，`services/agent` 依然会优先使用这些真实文本，不会直接退回 stub。
- 如果没有 transcript override / sidecar / manifest，且 `asr_provider = "grpc"`，`services/agent` 会通过 gRPC 调用 `services/asr`；
- 如果没有 transcript override / sidecar / manifest，且 `asr_provider = "api"`，`services/agent` 会调用你队友提供的 ASR HTTP API；
- 如果 MiniMax 环境变量可用，`reasoning` 和 `feedback` 节点会优先使用 MiniMax 生成更自然的总结和建议，否则自动回退到规则版输出。

对你当前这批样本，还需要注意一个实际数据细节：

- 多个 `en_test_*.wav` 文件虽然扩展名是 `.wav`，但文件头实际是 FLAC；
- `services/agent` 现在会按文件头识别真实 container，并跳过不适用的 WAV 细节提取，避免在 demo 数据上报错。

## LLM / API / W&B 环境变量

### MiniMax LLM

```bash
export MINIMAX_API_KEY=...
export MINIMAX_BASE_URL=...
export SPEAKSURE_LLM_MODEL=MiniMax-M2.7
```

### Prompt 模板

`reasoning` 和 `feedback` 不再把 prompt 固定写死在节点代码里，默认改为从下面这些文档读取：

- `services/agent/config/prompts/reasoning_system.md`
- `services/agent/config/prompts/reasoning_user.md`
- `services/agent/config/prompts/feedback_system.md`
- `services/agent/config/prompts/feedback_user.md`
- `services/agent/config/prompts/json_repair_system.md`
- `services/agent/config/prompts/json_repair_user.md`
- `services/agent/config/prompts/schemas/reasoning_result.json`
- `services/agent/config/prompts/schemas/feedback_segments_result.json`

默认路径在 `services/agent/config/config.toml` 里配置：

```toml
[speaksure.prompts]
reasoning_system = "prompts/reasoning_system.md"
reasoning_user = "prompts/reasoning_user.md"
feedback_system = "prompts/feedback_system.md"
feedback_user = "prompts/feedback_user.md"
json_repair_system = "prompts/json_repair_system.md"
json_repair_user = "prompts/json_repair_user.md"
reasoning_repair_schema = "prompts/schemas/reasoning_result.json"
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

重新生成 Python stub：

```bash
UV_CACHE_DIR=.cache/uvtmp uv run python services/generate_proto.py
```

启动服务：

```bash
just proto-gen
just run-asr-grpc
just run-agent-grpc
just run-agent-http
```

如果你想在“单体后端”模式下直接让 `services/agent` 在进程内调用 ASR，而不是通过 gRPC：

```bash
just run-backend-monolith
```

如果你想显式切换 agent 的 ASR 传输模式，也可以直接给 `just` 传参数：

```bash
just run-agent-http local
just run-agent-http grpc
just run-agent-grpc local
just run-agent-grpc grpc
```

这里的含义是：

- `local`：Agent 直接在内存中调用 `services/asr` 代码路径，不经过 gRPC
- `grpc`：Agent 通过 gRPC 调 `services/asr`

现在 `services/asr` 还额外拆了一个内部 backend 层，和 transport 分开：

- transport：`local` / `grpc` / `api` / `stub`
- backend：`onnx` / `stub` / `grpc`

也就是说：

- `local` / `grpc` 说的是 Agent 怎么访问 ASR
- `onnx` / `stub` / `grpc` 说的是 ASR 服务内部到底用什么模型后端

backend 本身建议放在 `services/agent/config/config.toml` 固定管理；
平时通过 `just` 动态切换的只有 `SPEAKSURE_ASR_PROVIDER`。

如果你要用 gRPC 模式的 HTTP 后端，也可以直接：

```bash
just run-backend-grpc
```

它会提示你先单独启动：

```bash
just run-asr-grpc
```

如果你想直接一键拉起整套本地微服务，也可以：

```bash
just compose-up
```

停止服务：

```bash
just compose-down
```

默认 bind 可以直接在 `services/agent/config/config.toml` 里统一配置：

```toml
[speaksure.runtime]
agent_grpc_bind = "127.0.0.1:50051"
asr_grpc_bind = "127.0.0.1:50052"
agent_http_bind = "127.0.0.1:8000"
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

如果你想单独控制 `services/asr` 的内部 backend：

```toml
[speaksure.runtime]
asr_backend = "onnx"
# asr_backend = "stub"
# asr_backend = "grpc"
# asr_backend_grpc_target = "127.0.0.1:50052"
# asr_onnx_model_dir = "services/asr/models/onnx-community__whisper-large-v3-turbo"
```

另外，目前建议只有这一个环境变量用于运行时快速切换：

- `SPEAKSURE_ASR_PROVIDER`

其他这些更稳定的值，建议统一写在 `services/agent/config/config.toml`：

- `asr_backend`
- `asr_backend_grpc_target`
- `asr_onnx_model_dir`
- `asr_grpc_target`
- `agent_grpc_bind`
- `asr_grpc_bind`
- `agent_http_bind`

如果你希望 CLI 也不再本地直调 agent，而是通过 gRPC 请求 `services/agent`，再加上：

```toml
[speaksure.runtime]
agent_grpc_target = "127.0.0.1:50051"
```

这样：

- `services/agent/cli.py analyze ...` 会变成 gRPC client；
- `services/agent/main.py` 是真正处理分析请求的 server；
- `services/agent` 内部再通过 gRPC 调 `services/asr`。

两个 gRPC server 现在都额外暴露了：

- gRPC Health Checking
- gRPC Server Reflection

也就是本地联调时可以直接用标准 gRPC tooling 做探活和列服务，而不用再额外写临时诊断接口。

另外，`AgentService.Analyze` 现在除了保留 `result_json` 这个完整结果外，还额外返回了结构化 `digest`：

- `request_id`
- `scenario`
- `transcript`
- `generated_at`
- `language`
- `asr_mode`
- `workflow_engine`
- `artifacts`

这样后续如果 CLI / UI / 其他 service 只需要读取摘要字段，就不必强依赖整份 JSON 反序列化。

### HTTP API

`services/agent` 现在也提供了面向前端的 FastAPI HTTP transport。

本地启动：

```bash
just run-agent-http
```

如果你要坚持直接用系统 Python，也可以：

```bash
python services/agent/http_main.py
```

最小 REST 接口：

- `GET /api/v1/health`
- `GET /api/v1/analyses`
- `POST /api/v1/analyses`
- `GET /api/v1/analyses/{analysis_id}`
- `GET /api/v1/analyses/{analysis_id}/result`
- `GET /api/v1/analyses/{analysis_id}/events`（SSE 实时事件流）
- `POST /api/v1/replays/load`（从本机结果 JSON 加载静态回放）

提交分析任务示例：

```bash
curl -X POST http://127.0.0.1:8000/api/v1/analyses \
  -F "audio=@services/agent/data/samples/audio/en_test_0315.wav" \
  -F "scenario=interview"
```

前端推荐调用方式：

- 浏览器 / Web 前端直接请求 HTTP API；
- 实时进度场景直接连 `GET /api/v1/analyses/{analysis_id}/events`，按 SSE 消费 `node_started` / `node_completed` / `analysis_completed`；
- 静态演示场景可以直接把 `/tmp/...json` 这类结果文件路径 POST 到 `/api/v1/replays/load`；
- `services/agent` 内部仍然可以通过 gRPC 调 `services/asr`；
- 如果后续还要加鉴权、用户体系、历史记录，再额外包一层 `services/api` 也不迟。

### Live Frontend

仓库里已经加了一个 Vite + React + TypeScript + shadcn-ui 风格的实时前端：

- `services/agent/frontend/`

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

先启动后端：

```bash
cd /root/private_data/workspace/csc5052-final-project
python services/agent/http_main.py
```

再启动前端：

```bash
cd /root/private_data/workspace/csc5052-final-project/services/agent/frontend
npm install
npm run dev
```

默认前端地址：

- `http://127.0.0.1:5173`

### 队友 ASR API

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

## 当前支持的场景

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

## 当前分析能力

### Lexical

会检测常见弱承诺 / 模糊表达，例如：

- `I think`
- `maybe`
- `probably`
- `I guess`
- `我觉得`
- `可能`
- `也许`

输出：

- `score`
- `triggers`
- `explanations`
- segment trigger highlights

### Prosody

当前是轻量规则版，主要使用：

- `speech_rate`
- `pause_count`
- `pause_duration`
- `energy_var`
- `pitch_var`

说明：

- 当前 `pitch_var` 是轻量 proxy，不是严格声学 pitch tracker；
- 第一版目的是先支撑 `services/agent` 融合与演示。

### Disfluency

当前会检测：

- filler：`um`、`uh`、`嗯`、`呃`、`那个`
- repetition：如 `I I`
- self-repair：如 `I mean`、`不是`、`我的意思是`

输出：

- `score`
- `issues`
- `explanations`
- segment highlights

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
  - `reasoning`
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

当前版本是规则版最小闭环，存在这些边界：

- 非 `.wav` 音频目前只做 passthrough，不做真正重采样转换；
- 没有接入正式 ASR 模型时，依赖 transcript override / sidecar / manifest / stub；
- prosody 还是轻量特征方案，不是完整声学模型；
- feedback 已可用，但仍偏模板化；
- 旧的新闻回测 / backtest agent 已从当前 `services/agent` 主线中移除。

## 测试

当前可以直接跑整套 `services/agent` 推理测试：

```bash
uv run pytest services/agent/tests -q
```

代码风格检查：

```bash
uv run ruff check \
  services/agent/cli.py \
  services/agent \
  services/asr \
  services/agent/tests
```

## 下一步建议

当前 `services/agent` 已经具备课程项目可演示的规则版闭环。接下来更合适的方向是：

1. 继续增强 feedback 话术和练习建议，让 demo 更像真实教练反馈
2. 接入真正的 ASR / lexical / prosody 模型 artifact
3. 基于 `services/agent/data/demo_outputs/summary.md` 继续挑 2-3 个代表样例做答辩展示
4. 再考虑接 UI 或可视化页面
