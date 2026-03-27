# Influx Vue

`influx-vue` is a Vue 3 + TypeScript workbench for exploring InfluxDB, building Flux queries, and turning results into charts, tables, and YAML-backed dashboards.

## Try The Sample Page

The quickest way to understand the project is to run the sample page first.

![Influx Vue sample page](public/screenshots/sample-page.png)

```bash
pnpm install
pnpm db:up
pnpm db:seed
pnpm dev
```

Open the Vite app URL shown in the terminal, then connect with the seeded demo config:

- `URL`: the same origin as the app, for example `http://127.0.0.1:5173` in dev or `http://127.0.0.1:4173` in preview
- `Org`: `influx-vue`
- `Bucket`: `demo-metrics`
- `Token`: `influx-vue-admin-token`
- `Username`: `influx`
- `Password`: `influx-password-123`

The local sample page starts with:

- 4 seeded buckets: `demo-metrics`, `edge-sensors`, `payments-stream`, `api-latency`
- synthetic 10 Hz sample data
- bucket -> measurement -> field -> tag exploration
- Flux editor mode
- chart, table, YAML, and dashboard views

If you want a one-command reset for the demo database:

```bash
pnpm db:down
pnpm db:up
pnpm db:seed
```

## What It Does

- Explore InfluxDB schema from the UI instead of typing Flux from scratch.
- Switch between guided explorer mode and raw query mode.
- Save the current query state as YAML.
- Rehydrate YAML into a dashboard layout with multiple panels.
- Run against a real InfluxDB container in integration tests.

## Install

If you are evaluating the project today, start with the sample page above.
When you package or publish it for reuse, the intended consumer-facing install is:

```bash
pnpm add influx-vue
```

```ts
import { InfluxWorkbench } from 'influx-vue'
import 'influx-vue/style.css'
```

## Basic Usage

Token-based initialization:

```vue
<script setup lang="ts">
import { InfluxWorkbench } from 'influx-vue'

const initialConnection = {
  url: window.location.origin,
  org: 'influx-vue',
  token: 'influx-vue-admin-token',
  bucket: 'demo-metrics',
}

function handleConnectError(payload: {
  phase: 'validation' | 'auth' | 'ping' | 'schema'
  error: Error
}) {
  console.error(payload.phase, payload.error.message)
}
</script>

<template>
  <InfluxWorkbench
    :initial-connection="initialConnection"
    auto-connect
    @connect-error="handleConnectError"
  />
</template>
```

Username/password initialization:

```vue
<script setup lang="ts">
import { InfluxWorkbench } from 'influx-vue'

const initialConnection = {
  url: window.location.origin,
  org: 'influx-vue',
  bucket: 'demo-metrics',
  authMethod: 'password' as const,
  username: 'influx',
  password: 'influx-password-123',
}
</script>

<template>
  <InfluxWorkbench
    :initial-connection="initialConnection"
    auto-connect
  />
</template>
```

Notes:

- `authMethod: 'token'` uses `token`.
- `authMethod: 'password'` signs in with `username` and `password`, then issues a token from the active session.
- Browser password login requires a same-origin InfluxDB proxy path on the app origin.
- If the signed-in account cannot `write` `authorizations`, the workbench surfaces the token issuance failure through `connect-error`.

## Public Component API

### Props

| Prop | Type | Description |
| --- | --- | --- |
| `initialConnection` | `Partial<InfluxConnectionConfig>` | Prefills the connection form before the user connects. |
| `autoConnect` | `boolean` | Attempts to connect on mount. |
| `autoRunQuery` | `boolean` | Runs the current query after a successful auto-connect. |
| `hiddenSections` | `InfluxWorkbenchSectionKey[]` | Hides top-level UI sections such as `hero`, `connection`, `explorer`, `results`. |
| `createDataSource` | `(config) => InfluxExplorerDataSource` | Advanced override for custom transports or proxy-backed integrations. |
| `authenticateConnection` | `(config) => Promise<InfluxConnectionConfig>` | Optional override for custom sign-in or token issuance flows before the workbench creates its data source. |

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `connect` | `{ connection, health, bucketCount }` | Fired after a successful connection and bucket load. |
| `connect-error` | `{ error, connection, phase }` | Fired when validation, auth, ping, or schema loading fails. |
| `disconnect` | `{ connection }` | Fired when the workbench disconnects. |

### Exposed Methods

You can drive the workbench imperatively via a template ref.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  InfluxWorkbench,
  type InfluxWorkbenchExposed,
} from 'influx-vue'

const workbenchRef = ref<InfluxWorkbenchExposed | null>(null)

async function reconnectToSensors() {
  workbenchRef.value?.applyConnection({
    bucket: 'edge-sensors',
  })

  await workbenchRef.value?.connect()
}
</script>

<template>
  <InfluxWorkbench ref="workbenchRef" />
</template>
```

Available methods:

- `applyConnection(connection)`
- `connect()`
- `disconnect()`
- `runQuery()`

## Local Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Tests

```bash
pnpm test:unit
pnpm test:integration
```

Notes:

- `test:integration` starts a real InfluxDB container with seeded sample data.
- The integration setup works with Docker and also supports local `colima` setups.

## Repository Layout

- [`src/components/InfluxWorkbench.vue`](src/components/InfluxWorkbench.vue): public workbench component
- [`src/composables/useInfluxWorkbench.ts`](src/composables/useInfluxWorkbench.ts): state and orchestration logic
- [`src/demo/App.vue`](src/demo/App.vue): sample page entry
- [`scripts/seed-influx.mts`](scripts/seed-influx.mts): local demo seeding
- [`tests/integration/influxExplorer.integration.spec.ts`](tests/integration/influxExplorer.integration.spec.ts): container-backed integration coverage
