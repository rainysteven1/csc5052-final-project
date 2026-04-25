# SpeakSure++ Prompt Templates

这里放的是运行时 LLM prompt 模板，`reasoning` 和 `feedback` 节点都会从这些文档读取 prompt，而不是把 prompt 固定写死在代码里。

## 当前模板

- `reasoning_system.md`
- `reasoning_user.md`
- `feedback_system.md`
- `feedback_user.md`
- `json_repair_system.md`
- `json_repair_user.md`
- `schemas/reasoning_result.json`
- `schemas/feedback_segments_result.json`

## 可用占位符

模板里可以直接写这些占位符：

- `{scenario}`
- `{style_constraints}`
- `{payload_json}`
- `{schema_name}`
- `{schema_json}`
- `{raw_response}`

渲染时只会替换上面这些已提供的键；其他花括号内容会保持原样，所以可以直接在文档里写 JSON schema。

## 配置方式

默认配置在 `services/agent/config/config.toml`：

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

这些路径默认相对于 `config.toml` 所在目录解析。

如果你想切换到别的 prompt 文档或 repair schema 示例，直接改这里即可。

## 调试实际 prompt

如果你想在结果 JSON 里看到“本次实际发给 LLM 的 prompt”，可以先设置：

```bash
export SPEAKSURE_DEBUG_PROMPTS=1
```

开启后，输出结果的 `meta.llm_prompts` 里会包含：

- 模板文件路径
- 渲染后的 system prompt
- 渲染后的 user prompt
