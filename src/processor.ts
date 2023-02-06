import {In} from 'typeorm'
import {
    assertNotNull,
    BatchHandlerContext,
    BatchProcessorItem,
    EvmBatchProcessor,
    EvmBlock,
} from '@subsquid/evm-processor'
import {Store, TypeormDatabase} from '@subsquid/typeorm-store'
import * as erc20 from './abi/erc20'
import {Account, Token, Transfer} from './model'

const CONTRACT_ADDRESS = assertNotNull(process.env.CONTRACT_ADDRESS, 'Missing contract address')
const CHAIN_NODE = assertNotNull(process.env.CHAIN_NODE, 'Missing chain node url')

const processor = new EvmBatchProcessor()
    .setDataSource({
        archive: 'https://eth.archive.subsquid.io',
        chain: CHAIN_NODE,
    })
    .addLog(CONTRACT_ADDRESS, {
        filter: [[erc20.events.Transfer.topic]],
        data: {
            evmLog: {
                topics: true,
                data: true,
            },
            transaction: {
                hash: true,
            },
        },
    })

type Item = BatchProcessorItem<typeof processor>
type Ctx = BatchHandlerContext<Store, Item>

processor.run(new TypeormDatabase(), async (ctx) => {
    let transfersData: TransferEventData[] = []

    ctx._chain.client.call('eth_blockNumber')

    for (let {header: block, items} of ctx.blocks) {
        for (let item of items) {
            if (item.kind !== 'evmLog') continue
            if (item.evmLog.topics[0] !== erc20.events.Transfer.topic) continue
            let event = erc20.events.Transfer.decode(item.evmLog)
            transfersData.push({
                id: item.evmLog.id,
                blockNumber: block.height,
                timestamp: new Date(block.timestamp),
                txHash: item.transaction.hash,
                from: event.from.toLowerCase(),
                to: event.to.toLowerCase(),
                amount: event.value.toBigInt(),
            })
        }
    }

    await saveTransfers(ctx, ctx.blocks[ctx.blocks.length - 1].header, transfersData)
})

async function saveTransfers(ctx: Ctx, block: EvmBlock, transfersData: TransferEventData[]) {
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
        token = await fetchToken(ctx, block, CONTRACT_ADDRESS)
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

async function fetchToken(ctx: Ctx, block: EvmBlock, address: string) {
    let contract = new erc20.Contract(ctx, block, address)

    let name = await contract.name()
    let symbol = await contract.symbol()
    let totalSupply = await contract.totalSupply().then((r) => r.toBigInt())
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
