// ==================== 阶段定义 ====================
const PHASE = {
    PREPARATION: '准备期',
    BUSINESS: '营业期',
    CLOSING: '打烊期',
    REST: '休息期'
};

let currentPhase = null;

// ==================== 辅助函数 ====================
function getPhase(moment) {
    if (moment >= 23000) return PHASE.PREPARATION;
    if (moment < 12000) return PHASE.BUSINESS;
    if (moment < 14000) return PHASE.CLOSING;
    return PHASE.REST;
}

function getDayCount(dayTime) {
    return Math.floor(dayTime / 24000) + 1;
}

function broadcast(server, msg) {
    server.runCommand('say [阶段] ' + msg);
}

// ==================== 启动时关闭命令反馈 ====================
ForgeEvents.onEvent('net.minecraftforge.event.server.ServerStartedEvent', event => {
    event.getServer().runCommand('gamerule sendCommandFeedback false');
});

// ==================== 服务端 Tick 事件 ====================
ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$ServerTickEvent', event => {
    const server = event.getServer();
    const tick = server.getTickCount();
    if (tick % 20 !== 0) return;

    const level = server.getLevel('minecraft:overworld');
    if (!level) return;

    const dayTime = level.getDayTime();
    const moment = dayTime % 24000;
    const dayCount = getDayCount(dayTime);
    const newPhase = getPhase(moment);

    if (currentPhase === null) {
        currentPhase = newPhase;
        broadcast(server, '当前阶段: ' + currentPhase);
    } else if (newPhase !== currentPhase) {
        const oldPhase = currentPhase;
        currentPhase = newPhase;
        broadcast(server, '阶段切换: ' + oldPhase + ' → ' + newPhase);

        const tips = {
            '准备期': '🕔 准备期：即将开始营业，请做好准备！',
            '营业期': '☀️ 营业期：欢迎光临！顾客们正在路上。',
            '打烊期': '🌆 打烊期：即将关门，请尽快完成交易！',
            '休息期': '🌙 休息期：商店已关闭，明天再会！'
        };
        if (tips[newPhase]) {
            server.runCommand('say [阶段] ' + tips[newPhase]);
        }
    }

    // 使用 /title 命令显示动作栏
    const displayMsg = '§e天数: ' + dayCount + '  §a阶段: ' + currentPhase;
    server.getPlayers().forEach(player => {
        server.runCommand('title ' + player.getName().getString() + ' actionbar {"text":"' + displayMsg + '"}');
    });
});

// ==================== 玩家登录事件 ====================
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerLoggedInEvent', event => {
    const player = event.getEntity();
    const server = player.getServer();
    const level = server.getLevel('minecraft:overworld');
    if (!level) return;

    const dayTime = level.getDayTime();
    const dayCount = getDayCount(dayTime);
    const phase = getPhase(dayTime % 24000);
    const playerName = player.getName().getString();

    server.runCommand('tellraw ' + playerName + ' {"text":"当前天数: ' + dayCount + '  阶段: ' + phase + '","color":"green"}');
    server.runCommand('title ' + playerName + ' actionbar {"text":"§e天数: ' + dayCount + '  §a阶段: ' + phase + '"}');
});