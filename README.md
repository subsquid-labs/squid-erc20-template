# ERC20 indexing template

A squid template indexing ERC20 transfers. The squid fetches the historical `Transfer` event, decodes and persists to a `Transfer` table. A new entry is created in the `Account` table for each address that has interacted with the contract so that one can query the transfer history for each EVM address.

Block data is streamed from a public [SQD Network Portal](https://docs.sqd.dev/en/sdk/squid-sdk/evm/reference/evm-stream) dataset — no API key or archive lookup is required, and it covers real-time unfinalized blocks. The `DataSourceBuilder` is defined in `src/processor.ts`; requested logs are decoded in batches by the handler passed to [`run()`](https://docs.sqd.dev/en/sdk/squid-sdk/evm/reference/batch-processor) in `src/main.ts`. Token metadata (`name`, `symbol`, `decimals`, `totalSupply`) is read from the contract state over an RPC endpoint.

Dependencies: Node.js v20 or newer, Git, Docker.

## Setup

- Install Squid CLI:

```bash
npm i -g @subsquid/cli
```

- Update the `CONTRACT_ADDRESS` and `CONTRACT_DEPLOYED_AT` in `.env`. By default, the [USDC contract](https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) is indexed. Set `.setPortal()` in `src/processor.ts` to the matching [Portal dataset](https://docs.sqd.dev/en/subsquid-network/reference/networks) if you switch networks.
- Set the `RPC_ENDPOINT` env variable to a chain node RPC URL — it is used to read token metadata from the contract state. Use [secrets](https://docs.sqd.dev/en/cloud/reference/env-variables) when deploying the squid to SQD Cloud.

## Run

```bash
npm install
# start a local Postgres
sqd up
# build the squid
sqd build
# start both the squid processor and the GraphQL server
sqd run .
```
A GraphiQL playground will be available at [localhost:4350/graphql](http://localhost:4350/graphql).

You can also start squid services one by one:
```bash
sqd process
sqd serve
```
