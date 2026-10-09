// ==================== 顾客实体注册 ====================
// 实体 ID：cubicalcanteen:customer
// 模型与贴图走默认路径，无需额外配置：
//   assets/cubicalcanteen/geo/entity/customer.geo.json
//   assets/cubicalcanteen/textures/entity/customer.png
//
// 注意：isImmobile(true) 会让 /kill（巨额伤害）清不掉顾客，
// 需要清理时用 customer_spawner.js 里的 global.clearCustomers()。
// 另外 isImmobile 也让实体没有 goalSelector，暂时无法挂 AI 目标 —— 见变更记录 006。

StartupEvents.registry('entity_type', event => {
    let Attributes = Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes')

    event.create('cubicalcanteen:customer', 'entityjs:living')
        .attributes(attr => {
            attr.add(Attributes.MAX_HEALTH, 20.0)
            attr.add(Attributes.MOVEMENT_SPEED, 0.0001)
            attr.add(Attributes.KNOCKBACK_RESISTANCE, 1.0)
        })
        .isPushable(false)
        .isImmobile(entity => true)
        .sized(0.6, 1.8)
        .displayName('顾客')
})
