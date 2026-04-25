# SpeakSure++ Live Frontend

Vite + React + TypeScript + shadcn-ui styled console for the `services/agent` HTTP API.

## What it does

- upload one audio clip to `POST /api/v1/analyses`
- subscribe to `GET /api/v1/analyses/{analysis_id}/events`
- load a saved runtime JSON from `POST /api/v1/replays/load`
- show the current workflow node, progress bar, event timeline, and latest node payload
- render the final analysis JSON after completion
- provide node-specific visual cards for prepare / ASR / lexical / prosody / feedback / serialize_result
- replay timeline controls: play, pause, previous, next, first, last

## Local run

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

默认会通过 Vite proxy 转发 `/api/*` 到：

- `http://127.0.0.1:8000`

如果你后端端口不同，可以先设置：

```bash
export VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

## Dev watcher stability

开发模式现在默认启用了 polling watcher，避免因为系统 `inotify` 限制过低导致 `ENOSPC: System limit for number of file watchers reached`。

如果你想手动调整：

```bash
export VITE_USE_POLLING=true
export VITE_POLLING_INTERVAL=1000
```

如果你的机器 watcher 足够，想关掉 polling：

```bash
export VITE_USE_POLLING=false
```

## Replay mode

前端里可以直接加载这种结果文件路径：

- `/tmp/speaksure-one-round/en_test_0315.presentation.json`

它会调用后端读取本地 JSON，再在前端生成一套静态 timeline 供回放查看。

回放加载后，前端支持：

- 自动播放
- 暂停
- 上一步 / 下一步
- 跳到第一步 / 最后一步

## Production build

```bash
cd /root/private_data/workspace/csc5052-final-project/services/agent/frontend
npm run build
```
