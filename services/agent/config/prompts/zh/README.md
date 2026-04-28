# SpeakSure++ Prompt Templates

这里放的是运行时 LLM prompt 模板。当前正式主链路只使用 `judgment` / `coaching` / `feedback` / `json_repair`，同时也为 `lexical` / `prosody` / `disfluency` 预留了配置化模板，方便继续扩展 evidence-to-LLM。

## Current Templates

- `lexical_system.md`
- `lexical_user.md`
- `prosody_system.md`
- `prosody_user.md`
- `disfluency_system.md`
- `disfluency_user.md`
- `judgment_system.md`
- `judgment_user.md`
- `coaching_system.md`
- `coaching_user.md`
- `feedback_system.md`
- `feedback_user.md`
- `json_repair_system.md`
- `json_repair_user.md`
- `schemas/lexical_result.json`
- `schemas/disfluency_result.json`
- `schemas/prosody_result.json`
- `schemas/judgment_result.json`
- `schemas/coaching_result.json`
- `schemas/feedback_segments_result.json`

## Available Placeholders

模板里可以直接写这些占位符：

- `{scenario}`
- `{style_constraints}`
- `{payload_json}`
- `{schema_name}`
- `{schema_json}`
- `{raw_response}`

渲染时只会替换上面这些已提供的键；其他花括号内容会保持原样，所以可以直接在文档里写 JSON schema。

## Configuration

默认配置在 `services/agent/config/config.toml`：

```toml
[speaksure.prompts]
lexical_system = "prompts/lexical_system.md"
lexical_user = "prompts/lexical_user.md"
prosody_system = "prompts/prosody_system.md"
prosody_user = "prompts/prosody_user.md"
disfluency_system = "prompts/disfluency_system.md"
disfluency_user = "prompts/disfluency_user.md"
judgment_system = "prompts/judgment_system.md"
judgment_user = "prompts/judgment_user.md"
coaching_system = "prompts/coaching_system.md"
coaching_user = "prompts/coaching_user.md"
feedback_system = "prompts/feedback_system.md"
feedback_user = "prompts/feedback_user.md"
json_repair_system = "prompts/json_repair_system.md"
json_repair_user = "prompts/json_repair_user.md"
lexical_repair_schema = "prompts/schemas/lexical_result.json"
disfluency_repair_schema = "prompts/schemas/disfluency_result.json"
prosody_repair_schema = "prompts/schemas/prosody_result.json"
judgment_repair_schema = "prompts/schemas/judgment_result.json"
coaching_repair_schema = "prompts/schemas/coaching_result.json"
feedback_repair_schema = "prompts/schemas/feedback_segments_result.json"
```

这些路径默认相对于 `config.toml` 所在目录解析；如果你想切换到别的 prompt 文档或 repair schema 示例，直接改这里即可。

## Debugging Rendered Prompts

如果你想在结果 JSON 里看到“本次实际发给 LLM 的 prompt”，可以先设置：

```bash
export SPEAKSURE_DEBUG_PROMPTS=1
```

开启后，输出结果的 `meta.llm_prompts` 里会包含：

- 模板文件路径
- 渲染后的 system prompt
- 渲染后的 user prompt
