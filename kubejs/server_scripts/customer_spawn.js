EntityEvents.spawned(event => {
    let entity = event.getEntity()
    if (entity.type !== 'entity.cubicalcanteen.customer') return
    entity.customName('顾客')
    entity.setCustomNameVisible(true)
})