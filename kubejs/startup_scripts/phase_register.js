// 服务器启动时关闭命令反馈
ForgeEvents.onEvent('net.minecraftforge.event.server.ServerStartedEvent', event => {
    if (typeof global.handleServerStarted === 'function') {
        global.handleServerStarted(event);
    }
});

// 每秒检测阶段和天数
ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$ServerTickEvent', event => {
    if (typeof global.handleServerTick === 'function') {
        global.handleServerTick(event);
    }
});

// 玩家登录时显示当前状态
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerLoggedInEvent', event => {
    if (typeof global.handlePlayerLoggedIn === 'function') {
        global.handlePlayerLoggedIn(event);
    }
});