# Insightify

## Development

### Cache/DB Consistency

- Set `DATABASE_URL` before running Core:

```bash
export DATABASE_URL='postgres://insightify:insightify@localhost:5432/insightify?sslmode=disable'
```

- Validate cache persistence/restore pipeline:

```bash
make verify-cache-pipeline
```

- Inspect persisted workspace/tab/node state:

```bash
make list-uiworkspace-nodes
make list-tab-nodes TAB_ID=tab-xxxx
```

- Contract details: `InsightifyCore/docs/cache_safety_pipeline.md`

### Protocol Buffers

To regenerate the Go code from the Protocol Buffer definitions, run the following command from the project root:

```bash
buf generate --template buf.gen.yaml
```

```bash
export DATABASE_URL='postgres://insightify:insightify@localhost:5432/insightify?sslmode=disable'
make healthy
```
