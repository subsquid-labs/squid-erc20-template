import {run} from '@subsquid/batch-processor'
import {augmentBlock} from '@subsquid/evm-objects'
import {TypeormDatabase} from '@subsquid/typeorm-store'
import {In} from 'typeorm'
import * as erc20 from './abi/erc20'
import {Account, Token, Transfer} from './model'
import {CONTRACT_ADDRESS, Context, dataSource, rpc} from './processor'

// TypeormDatabase stores the data to Postgres and handles hot-block rollbacks on forks.
// run() drives the processing loop, passing each batch of data to the handler.
run(dataSource, new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    // augmentBlock() enriches raw block items with ids and navigation helpers.
    let blocks = ctx.blocks.map(augmentBlock)
    let transfersData: TransferEventData[] = []

    for (let block of blocks) {
        for (let log of block.logs) {
            if (log.topics[0] !== erc20.events.Transfer.topic) continue

            let event = erc20.events.Transfer.decode(log)
            transfersData.push({
                id: log.id,
                blockNumber: block.header.number,
                timestamp: new Date(block.header.timestamp),
                txHash: log.transaction?.hash || '0x',
                from: event.from.toLowerCase(),
                to: event.to.toLowerCase(),
                amount: event.value,
            })
        }
    }

    await saveTransfers(ctx, transfersData)
})

async function saveTransfers(ctx: Context, transfersData: TransferEventData[]) {
    let accountIds = new Set<string>()
    for (let t of transfersData) {
        accountIds.add(t.from)
        accountIds.add(t.to)
    }

    let accounts = await ctx.store
        .findBy(Account, {id: In([...accountIds])})
        .then((q) => new Map(q.map((i) => [i.id, i])))

    let transfers: Transfer[] = []

    let token = await ctx.store.get(Token, CONTRACT_ADDRESS)
    if (token == null) {
        token = await fetchToken(ctx, CONTRACT_ADDRESS)
        await ctx.store.insert(token)
    }

    for (let t of transfersData) {
        let {id, blockNumber, timestamp, txHash, amount} = t

        let from = getAccount(accounts, t.from)
        let to = getAccount(accounts, t.to)

        transfers.push(
            new Transfer({
                id,
                blockNumber,
                timestamp,
                txHash,
                from,
                to,
                amount,
            })
        )
    }

    await ctx.store.upsert(Array.from(accounts.values()))
    await ctx.store.insert(transfers)
}

async function fetchToken(ctx: Context, address: string) {
    let header = ctx.blocks[ctx.blocks.length - 1].header

    // The Portal handler context carries no RPC client, so state queries go through
    // the explicit RpcClient created in processor.ts.
    let contract = new erc20.Contract({_chain: {client: rpc}}, {height: header.number}, address)

    let name = await contract.name()
    let symbol = await contract.symbol()
    let totalSupply = await contract.totalSupply()
    let decimals = await contract.decimals()

    return new Token({
        id: address,
        name,
        symbol,
        totalSupply,
        decimals,
    })
}

interface TransferEventData {
    id: string
    blockNumber: number
    timestamp: Date
    txHash: string
    from: string
    to: string
    amount: bigint
}

function getAccount(m: Map<string, Account>, id: string): Account {
    let acc = m.get(id)
    if (acc == null) {
        acc = new Account()
        acc.id = id
        m.set(id, acc)
    }
    return acc
}
