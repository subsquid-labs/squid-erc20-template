import {DataHandlerContext} from '@subsquid/batch-processor'
import {Block as _Block, DataSourceBuilder, EVMDataSource, Log as _Log, Transaction as _Transaction} from '@subsquid/evm-stream'
import {RpcClient} from '@subsquid/rpc-client'
import {Store} from '@subsquid/typeorm-store'
import {assertNotNull} from '@subsquid/util-internal'
import * as erc20 from './abi/erc20'

// Set at .env or replace with a ERC20 contract address
export const CONTRACT_ADDRESS = assertNotNull(process.env.CONTRACT_ADDRESS).toLowerCase()
export const CONTRACT_DEPLOYED_AT = parseInt(assertNotNull(process.env.CONTRACT_DEPLOYED_AT))

// This template reads token metadata directly from the contract (see fetchToken()
// in main.ts). The Portal handler context has no built-in RPC client, so we create
// one explicitly. Set the URL via .env for local runs or via secrets when deploying
// to SQD Cloud: https://docs.sqd.dev/en/cloud/reference/env-variables
export const rpc = new RpcClient({
    url: assertNotNull(process.env.RPC_ENDPOINT),
    rateLimit: 10,
})

// A DataSourceBuilder defines where to get the data and what data to fetch.
export const dataSource = new DataSourceBuilder()
    // The SQD Network Portal is the primary source of blockchain data: it is public,
    // needs no API key, and streams pre-filtered data — including real-time unfinalized
    // blocks — far faster than a plain RPC endpoint.
    // Browse the available datasets at https://docs.sqd.ai/subsquid-network/reference/networks/
    .setPortal('https://portal.sqd.dev/datasets/ethereum-mainnet')
    // To use a private or rate-limit-lifted Portal, supply an API key
    // through the HTTP client headers (create a key at https://portal.sqd.dev/app):
    // .setPortal({
    //     url: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
    //     http: {
    //         headers: {'x-api-key': process.env.SQD_API_KEY},
    //     },
    // })
    .setBlockRange({from: CONTRACT_DEPLOYED_AT})
    // Field selection is explicit: there are no default optional fields, so list every
    // field the handler reads. See
    // https://docs.sqd.dev/en/sdk/squid-sdk/evm/reference/evm-stream/field-selection
    .setFields({
        block: {
            timestamp: true,
        },
        log: {
            topics: true,
            data: true,
        },
        transaction: {
            hash: true,
        },
    })
    // Request all logs of the ERC20 contract carrying a Transfer topic, and include
    // the parent transaction of each so we can record its hash.
    .addLog({
        where: {
            address: [CONTRACT_ADDRESS],
            topic0: [erc20.events.Transfer.topic],
        },
        include: {
            transaction: true,
        },
    })
    .build()

export type Fields = typeof dataSource extends EVMDataSource<infer F> ? F : never
export type Context = DataHandlerContext<_Block<Fields>, Store>
export type Block = _Block<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
