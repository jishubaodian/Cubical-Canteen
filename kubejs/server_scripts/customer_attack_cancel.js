EntityEvents.hurt(event => {
    let entity = event.getEntity()
    console.log('[调试] hurt 触发，type: ' + entity.type)
    if (entity.type !== 'entity.cubicalcanteen.customer') return
    console.log('[调试] 取消伤害')
    event.cancel()
})