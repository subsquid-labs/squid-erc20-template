# ERC20 indexing template

A squid template indexing ERC20 transfers. The squid fetch the historical `Transfer` event, decodes and persists to a `Transfer` table. A new entry is created in the `Account` table for each address that has interacted with the contract so that one can query the transfer history for each EVM address.

## Setup

- Install Squid CLI:

```bash
npm i -g @subsquid/cli
```

- Update the `CONTRACT_ADDRESS` in `src/processor.ts`. By default, the [USDC contract](https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) is indexed
- Inspect the list of the available archives with `sqd archives:ls` and choose the network if necessary
- Set `CHAIN_NODE` env variable to an RPC endpoint. Use [secrets](https://docs.subsquid.io/deploy-squid/env-variables/#secrets) when deploying the squid to Aquarium.

## Run

```bash
npm ci
sqd build
# start a local Postgres
sqd up
# run src/processor.ts
sqd process

# in a separate termimal
# start the GraphQL API server
sqd serve
sqd open http://localhost:4350/graphql
```