ForgeEvents.onEvent('net.minecraftforge.event.server.ServerStartedEvent', event => {
    if (typeof global.handleServerStarted === 'function') {
        global.handleServerStarted(event);
    }
});

ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$ServerTickEvent', event => {
    if (typeof global.handleServerTick === 'function') {
        global.handleServerTick(event);
    }
});

ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerLoggedInEvent', event => {
    if (typeof global.handlePlayerLoggedIn === 'function') {
        global.handlePlayerLoggedIn(event);
    }
});