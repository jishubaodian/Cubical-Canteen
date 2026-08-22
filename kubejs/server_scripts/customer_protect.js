// 顾客实体保护 —— 只防玩家攻击，允许 /kill 清除
EntityEvents.hurt(event => {
    let entity = event.entity
    if (entity.type !== 'entity.cubicalcanteen.customer') return

    let attacker = event.source.actual   // 获取伤害发起实体（玩家近战/弓箭/药水等）
    if (attacker && attacker.isPlayer()) {
        event.cancel()                   // 取消玩家造成的所有伤害
    }
    // /kill 的 attacker 为 null，不会取消，顾客正常死亡
})