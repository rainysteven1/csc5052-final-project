Run these commands as an isolated uv project from `scripts/command`:

```bash
cd scripts/command
uv sync
uv run python main.py --help
```

The CLI is now centralized in `scripts/command/main.py`, while `src/` only contains reusable
implementation methods.

From the repository root, you can also use:

```bash
python scripts/command/main.py --help
python scripts/command/main.py download-models --help
python scripts/command/main.py release-commit --preview
```

You can still use the installed command entry directly inside `scripts/command`:

```bash
cd scripts/command
uv run command --help
uv run command download-models --help
uv run command release-commit --preview
```

`uv sync` now resolves against `scripts/command/pyproject.toml` and creates the environment at
`scripts/command/.venv`, not the repository root.

The downloader first loads the repository root `.env` with `python-dotenv`, so values like
`HF_TOKEN` or `HF_ENDPOINT` can come from the root config file directly.

Model selection and file download rules are primarily loaded from:

```bash
scripts/command/config/download_models.yaml
```

The command reads that YAML with Pydantic validation. If some fields are missing, it falls back to
the built-in defaults. If the YAML file is missing entirely, the command still works with the
fallback rules.

If `HF_ENDPOINT` is still unset after loading `.env`, the downloader defaults to:

```bash
HF_ENDPOINT=https://hf-mirror.com
```

Existing environment variables are kept as-is.

For unstable networks, the downloader also applies safer defaults:

```bash
HF_HUB_DISABLE_XET=1
HF_HUB_DOWNLOAD_TIMEOUT=60
HF_HUB_ETAG_TIMEOUT=30
HF_DOWNLOAD_MAX_WORKERS=2
```

You can still override them in the root `.env`.

For ONNX repositories, the downloader fetches only int8 ONNX files plus the minimal config /
tokenizer files needed to load them.

For non-ONNX repositories, the downloader does not fetch the whole repo by default. It prefers:

1. `model.safetensors`
2. `model.safetensors.index.json` + `model-*.safetensors`
3. `pytorch_model.bin`
4. `pytorch_model.bin.index.json` + `pytorch_model-*.bin`

along with the minimal config / tokenizer files needed to load the model.

If a single model fails to resolve or download, the command does not stop the whole batch
immediately. It continues with the remaining models and prints a final summary table with all
errors at the end.

Optional flags:

```bash
python scripts/command/main.py download-models --list
python scripts/command/main.py download-models --preset cpu-minimal --yes
python scripts/command/main.py download-models --preset full-demo --yes
uv run command download-models --list
```

When you pass `--yes`, the command also uses the default installer behavior and skips already-ready
models automatically unless you explicitly add `--include-existing`.

Release commit examples:

```bash
python scripts/command/main.py release-commit --preview
python scripts/command/main.py release-commit --preview --plain
python scripts/command/main.py release-commit
```

In commit mode, `release-commit` automatically calls local `codex exec` with
`$commit-generate`, extracts the generated bullets/footer, and combines them
with the fixed release header for the detected service version bump.
