ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', event => {
    let entity = event.getEntity()
    console.log('[调试] LivingHurtEvent 触发，type: ' + entity.type)
    if (entity.type !== 'entity.cubicalcanteen.customer') return
    console.log('[调试] LivingHurtEvent 取消伤害')
    event.setCanceled(true)
})