(function() {
    'use strict';

    // ==================== 营业时段定义 ====================
    let PHASE = {
        PREPARATION: '备餐期',
        BUSINESS: '营业中',
        CLOSING: '收尾期',
        REST: '歇业期'
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
        server.runCommand('say [餐厅] ' + msg);
    }

    // ==================== 服务器启动 ====================
    global.handleServerStarted = function(event) {
        let server = event.getServer();
        server.runCommand('gamerule sendCommandFeedback false');

        if (global.selectedRestDay === undefined) {
            global.selectedRestDay = -1;
        }
        if (global.selectedRestDayNotified === undefined) {
            global.selectedRestDayNotified = -1;
        }
        if (global.lastRestDayWarning === undefined) {
            global.lastRestDayWarning = -1;
        }
        if (global.lastSelectedRestDayWarning === undefined) {
            global.lastSelectedRestDayWarning = -1;
        }
        if (global.restDayNotified === undefined) {
            global.restDayNotified = -1;
        }
    };

    // ==================== 每秒检测 ====================
    global.handleServerTick = function(event) {
        let server = event.getServer();
        let tick = server.getTickCount();
        if (tick % 20 !== 0) return;

        let level = server.getLevel('minecraft:overworld');
        if (!level) return;

        let dayTime = level.getDayTime();
        let moment = dayTime % 24000;
        let dayCount = getDayCount(dayTime);
        let newPhase = getPhase(moment);

        let isForcedRestDay = (dayCount % 5 === 0);
        let isPlayerSelectedRest = (global.selectedRestDay === dayCount);
        let isRestDay = isForcedRestDay || isPlayerSelectedRest;

        global.isRestDay = isRestDay;
        global.currentDay = dayCount;

        // 自选休店生效时提示
        if (isPlayerSelectedRest && global.selectedRestDayNotified !== dayCount) {
            global.selectedRestDayNotified = dayCount;
            server.runCommand('say [餐厅] 今日店主自选休店，餐厅暂不营业！');
        }

        // 前一晚预告（20:00后）
        if (moment >= 20000 && moment < 24000) {
            let nextDay = dayCount + 1;
            let nextIsForced = (nextDay % 5 === 0);
            let nextIsSelected = (global.selectedRestDay === nextDay);

            if (nextIsForced && global.lastRestDayWarning !== nextDay) {
                global.lastRestDayWarning = nextDay;
                server.runCommand('say [预告] 明日（第' + nextDay + '天）为法定休店日！');
            }

            if (nextIsSelected && global.lastSelectedRestDayWarning !== nextDay) {
                global.lastSelectedRestDayWarning = nextDay;
                server.runCommand('say [预告] 明日（第' + nextDay + '天）已安排店主休店日！');
            }
        }

        // 法定休店日当天提示
        if (isForcedRestDay && global.restDayNotified !== dayCount) {
            global.restDayNotified = dayCount;
            server.runCommand('say [休店] 今日（第' + dayCount + '天）为法定休店日，餐厅歇业一天！');
        }

        // 阶段切换
        if (currentPhase === null) {
            currentPhase = newPhase;
            broadcast(server, '当前时段: ' + currentPhase);
        } else if (newPhase !== currentPhase) {
            let previousPhase = currentPhase;
            currentPhase = newPhase;
            broadcast(server, '时段切换: ' + previousPhase + ' → ' + newPhase);

            let tips = {
                '备餐期': '🕔 备餐期：厨师准备食材，即将开门迎客！',
                '营业中': '☀️ 营业中：欢迎光临！食客们正在路上。',
                '收尾期': '🌆 收尾期：即将关门，请尽快下单！',
                '歇业期': '🌙 歇业期：餐厅已打烊，明日再会！'
            };
            if (tips[newPhase]) {
                server.runCommand('say [餐厅] ' + tips[newPhase]);
            }
        }

        // ==================== 动作栏显示（含余额） ====================
        server.getPlayers().forEach(player => {
            // 获取玩家余额
            let balance = 0;
            if (typeof global.getBalance === 'function') {
                balance = global.getBalance(player);
            }
            let balanceStr = '$' + balance;
            if (typeof global.formatCurrency === 'function') {
                balanceStr = global.formatCurrency(balance);
            }

            let restTag = '';
            if (isForcedRestDay) {
                restTag = ' §c[法定休店日]';
            } else if (isPlayerSelectedRest) {
                restTag = ' §e[店主休店日]';
            }

            let displayMsg = balanceStr + ' | §e天数: ' + dayCount + '  §a时段: ' + currentPhase + restTag;
            server.runCommand('title ' + player.getName().getString() + ' actionbar {"text":"' + displayMsg + '"}');
        });
    };

    // ==================== 玩家登录 ====================
    global.handlePlayerLoggedIn = function(event) {
        let player = event.getEntity();
        let server = player.getServer();
        let level = server.getLevel('minecraft:overworld');
        if (!level) return;

        let dayTime = level.getDayTime();
        let dayCount = getDayCount(dayTime);
        let phase = getPhase(dayTime % 24000);
        let isForcedRestDay = (dayCount % 5 === 0);
        let isPlayerSelectedRest = (global.selectedRestDay === dayCount);
        let playerName = player.getName().getString();

        let restMsg = '';
        if (isForcedRestDay) restMsg = ' (法定休店日)';
        else if (isPlayerSelectedRest) restMsg = ' (店主休店日)';

        server.runCommand('tellraw ' + playerName + ' {"text":"当前天数: ' + dayCount + '  时段: ' + phase + restMsg + '","color":"green"}');

        // 动作栏（含余额）
        let balance = 0;
        if (typeof global.getBalance === 'function') {
            balance = global.getBalance(player);
        }
        let balanceStr = '$' + balance;
        if (typeof global.formatCurrency === 'function') {
            balanceStr = global.formatCurrency(balance);
        }

        let restTag = '';
        if (isForcedRestDay) restTag = ' §c[法定休店日]';
        else if (isPlayerSelectedRest) restTag = ' §e[店主休店日]';

        let displayMsg = balanceStr + ' | §e天数: ' + dayCount + '  §a时段: ' + phase + restTag;
        server.runCommand('title ' + playerName + ' actionbar {"text":"' + displayMsg + '"}');

        if (global.selectedRestDay === dayCount + 1) {
            player.sendSystemMessage('§e提示：明日（第' + (dayCount + 1) + '天）已安排店主休店日。');
        }
    };

})();