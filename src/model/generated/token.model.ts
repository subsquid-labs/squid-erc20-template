import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {Transfer} from "./transfer.model"

@Entity_()
export class Token {
    constructor(props?: Partial<Token>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: false})
    name!: string

    @Column_("text", {nullable: false})
    symbol!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    totalSupply!: bigint

    @Column_("int4", {nullable: false})
    decimals!: number

    @OneToMany_(() => Transfer, e => e.token)
    transfers!: Transfer[]
}
