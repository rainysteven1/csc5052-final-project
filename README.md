# SpeakSure++

## Quick Start

先复制环境变量模板：

```bash
just init-env
```

然后按需填写：

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `SPEAKSURE_ASR_PROVIDER`

大部分稳定配置现在建议直接写在：

- `services/agent/config/config.toml`

例如：

- `asr_backend`
- `asr_onnx_model_dir`
- `asr_grpc_target`
- `agent_grpc_bind`
- `agent_http_bind`

更完整的服务说明看：

- `services/agent/README.md`
- `docs/SpeakSure++_HuggingFace预训练模型选型与下载清单.md`

如果你想快速检查当前运行配置：

```bash
just doctor
```
