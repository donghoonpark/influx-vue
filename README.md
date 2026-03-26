# Influx Vue

`Influx Vue`는 Vue 3 + TypeScript + Naive UI 기반으로 InfluxDB를 연결하고, `bucket -> measurement -> field/tag -> tag value` 흐름으로 탐색하고, Flux 쿼리를 작성하고, 결과를 테이블과 차트로 시각화하기 위한 컴포넌트 프로젝트입니다.

## Current focus

- Reusable `InfluxWorkbench` component
- Local demo app powered by Vite
- Unit tests for query and state logic
- Real InfluxDB container integration tests

## Development

```bash
pnpm install
pnpm dev
```

## Local demo InfluxDB

```bash
pnpm db:up
pnpm db:seed
pnpm dev
```

기본 로컬 연결값은 아래와 같습니다.

- `URL`: `http://127.0.0.1:8086`
- `Org`: `influx-vue`
- `Bucket`: `demo-metrics`
- `Token`: `influx-vue-admin-token`

## Build

```bash
pnpm build
```

## Tests

```bash
pnpm test:unit
pnpm test:integration
```

`test:integration`은 실제 InfluxDB 컨테이너를 띄운 뒤 schema 탐색과 Flux 실행을 검증합니다. `colima` 환경에서는 자동으로 `~/.colima/docker.sock`를 감지해 사용합니다.
