# Current Service Topology

The active production-facing topology is:

```text
frontend -> backend(go) -> agent(python)
```

The agent owns its ASR runtime internally:

```text
services/agent/src/asr
```

There is no separate standalone `services/asr` service in the active architecture.
