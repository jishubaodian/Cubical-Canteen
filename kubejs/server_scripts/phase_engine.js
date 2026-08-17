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
    return Math.floor(dayTime / 24000);
}

function broadcast(server, msg) {
    server.runCommand('say [阶段] ' + msg);
}

// ==================== 服务器启动 ====================
global.handleServerStarted = function(event) {
    event.getServer().runCommand('gamerule sendCommandFeedback false');
};

// ==================== 每秒检测 ====================
global.handleServerTick = function(event) {
    const server = event.getServer();
    const tick = server.getTickCount();
    if (tick % 20 !== 0) return;

    const level = server.getLevel('minecraft:overworld');
    if (!level) return;

    const dayTime = level.getDayTime();
    const moment = dayTime % 24000;
    const dayCount = getDayCount(dayTime);
    const newPhase = getPhase(moment);

    const isRestDay = (dayCount % 5 === 0);
    global.isRestDay = isRestDay;
    global.currentDay = dayCount;

    // 前一晚预告休息日（20:00后）
    if (moment >= 20000 && moment < 24000) {
        const nextDay = dayCount + 1;
        if (nextDay % 5 === 0 && global.lastRestDayWarning !== nextDay) {
            global.lastRestDayWarning = nextDay;
            server.runCommand('say [预告] 明天（第' + nextDay + '天）是强制休息日！');
        }
    }

    // 休息日当天首次检测时提示
    if (isRestDay && global.restDayNotified !== dayCount) {
        global.restDayNotified = dayCount;
        server.runCommand('say [休息日] 今天（第' + dayCount + '天）是强制休息日，商店暂停营业！');
    }

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

    // 动作栏显示天数和阶段
    let restTag = isRestDay ? ' §c[休息日]' : '';
    const displayMsg = '§e天数: ' + dayCount + '  §a阶段: ' + currentPhase + restTag;
    server.getPlayers().forEach(player => {
        server.runCommand('title ' + player.getName().getString() + ' actionbar {"text":"' + displayMsg + '"}');
    });
};

// ==================== 玩家登录 ====================
global.handlePlayerLoggedIn = function(event) {
    const player = event.getEntity();
    const server = player.getServer();
    const level = server.getLevel('minecraft:overworld');
    if (!level) return;

    const dayTime = level.getDayTime();
    const dayCount = getDayCount(dayTime);
    const phase = getPhase(dayTime % 24000);
    const isRestDay = (dayCount % 5 === 0);
    const playerName = player.getName().getString();

    let restMsg = isRestDay ? ' (强制休息日)' : '';
    server.runCommand('tellraw ' + playerName + ' {"text":"当前天数: ' + dayCount + '  阶段: ' + phase + restMsg + '","color":"green"}');
    server.runCommand('title ' + playerName + ' actionbar {"text":"§e天数: ' + dayCount + '  §a阶段: ' + phase + (isRestDay ? ' §c[休息日]' : '') + '"}');
};