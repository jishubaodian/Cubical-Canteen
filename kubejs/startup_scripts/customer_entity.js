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