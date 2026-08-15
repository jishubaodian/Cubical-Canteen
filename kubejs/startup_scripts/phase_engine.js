// 时间阶段引擎 - 使用 ForgeEvents（放在 startup_scripts）

console.log('[Phase] 引擎加载中...');

// 阶段定义
const PHASE = {
    PREPARATION: 'preparation',
    BUSINESS: 'business',
    CLOSING: 'closing',
    REST: 'rest'
};

// 当前阶段
let currentPhase = null;

// 根据游戏刻计算阶段
// 准备期: 5:00-6:00   → tick ∈ [23000, 24000)
// 营业期: 6:00-18:00  → tick ∈ [0, 12000)
// 打烊期: 18:00-20:00 → tick ∈ [12000, 14000)
// 休息期: 20:00-5:00  → tick ∈ [14000, 23000)
function getPhase(dayTime) {
    const tick = dayTime % 24000;
    if (tick >= 23000) return PHASE.PREPARATION;
    if (tick < 12000) return PHASE.BUSINESS;
    if (tick < 14000) return PHASE.CLOSING;
    return PHASE.REST;
}

// 发送消息到聊天框
function broadcast(server, msg) {
    server.runCommand('say [阶段] ' + msg);
    console.log('[Phase] ' + msg);
}

// 监听服务器 tick 事件
ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$ServerTickEvent', event => {
    const server = event.getServer();
    const tick = server.getTickCount();

    // 每秒检测一次（20 tick）
    if (tick % 20 !== 0) return;

    // 获取主世界
    const level = server.getLevel('minecraft:overworld');
    if (!level) return;

    const dayTime = level.getDayTime();
    const newPhase = getPhase(dayTime);

    // 首次初始化
    if (currentPhase === null) {
        currentPhase = newPhase;
        broadcast(server, '当前阶段: ' + currentPhase);
        return;
    }

    // 阶段切换
    if (newPhase !== currentPhase) {
        const oldPhase = currentPhase;
        currentPhase = newPhase;

        broadcast(server, '阶段切换: ' + oldPhase + ' → ' + newPhase);

        // 发送阶段提示
        let tips = {
            'preparation': '🕔 准备期：即将开始营业，请做好准备！',
            'business': '☀️ 营业期：欢迎光临！顾客们正在路上。',
            'closing': '🌆 打烊期：即将关门，请尽快完成交易！',
            'rest': '🌙 休息期：商店已关闭，明天再会！'
        };
        if (tips[newPhase]) {
            server.runCommand('say [阶段] ' + tips[newPhase]);
        }
    }
});

// 玩家登录时告知当前阶段（使用 PlayerLoggedInEvent）
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerLoggedInEvent', event => {
    const player = event.getEntity();
    if (currentPhase) {
        player.sendSystemMessage('当前阶段: ' + currentPhase);
    }
});

console.log('[Phase] 引擎加载完毕！');