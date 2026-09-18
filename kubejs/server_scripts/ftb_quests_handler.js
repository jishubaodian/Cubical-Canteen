// ==================== FTB Quests 次日安排处理器 ====================
// 完成带 rest_day_toggle 标签的任务时，安排 / 取消"明日店主自选休店"。
//
// 休店日选择统一交给 phase_manager 管理（它负责持久化），本文件只调用接口。
// 天数口径要和 phase_manager 一致：从 Day 1 开始，所以是 floor(dayTime/24000) + 1。

(function () {
    'use strict';

    let DAY_LENGTH = 24000;
    let REST_DAY_PERIOD = 5;      // 必须与 phase_manager.js 保持一致

    let processingLock = false;
    let lockTimer = null;

    function readSelectedRestDay() {
        try {
            if (typeof global.getSelectedRestDay === 'function') {
                return global.getSelectedRestDay();
            }
        } catch (e) {
            console.log('[餐厅] 读取休店日选择失败: ' + e);
        }
        return -1;
    }

    function writeSelectedRestDay(day) {
        try {
            if (typeof global.setSelectedRestDay === 'function') {
                global.setSelectedRestDay(day);
                return true;
            }
        } catch (e) {
            console.log('[餐厅] 写入休店日选择失败: ' + e);
        }
        return false;
    }

    function clearSelectedRestDay() {
        try {
            if (typeof global.clearSelectedRestDay === 'function') {
                global.clearSelectedRestDay();
                return true;
            }
        } catch (e) {
            console.log('[餐厅] 清除休店日选择失败: ' + e);
        }
        return false;
    }

    FTBQuestsEvents.completed(event => {
        let quest = event.getObject();
        let player = event.player;

        if (!quest.hasTag('rest_day_toggle')) {
            return;
        }

        // 防抖锁：延时释放，防止连续多次触发
        if (processingLock) {
            return;
        }
        processingLock = true;

        // 清除之前的定时器
        if (lockTimer) {
            clearTimeout(lockTimer);
            lockTimer = null;
        }

        try {
            let server = player.getServer();
            if (!server) {
                processingLock = false;
                return;
            }
            let level = server.overworld();
            if (!level) {
                processingLock = false;
                return;
            }

            let dayTime = level.getDayTime();
            let moment = dayTime % DAY_LENGTH;
            let dayCount = Math.floor(dayTime / DAY_LENGTH) + 1;   // 与 phase_manager 口径一致
            let targetDay = dayCount + 1;
            let nextDayIsForcedRest = (targetDay % REST_DAY_PERIOD === 0);

            // 可操作时段：收尾期（18:00-20:00）和歇业期（20:00-次日 5:00）
            let canOperate = (moment >= 12000);

            if (!canOperate) {
                player.sendSystemMessage('§c当前时段不可操作，请在收尾期（18:00-20:00）或歇业期操作！');
                processingLock = false;
                return;
            }

            if (nextDayIsForcedRest) {
                player.sendSystemMessage('§c明日为法定休店日，无需设置！');
                processingLock = false;
                return;
            }

            let playerName = '';
            try {
                playerName = player.getName().getString();
            } catch (e) {
                playerName = '';
            }

            if (readSelectedRestDay() === targetDay) {
                clearSelectedRestDay();
                player.sendSystemMessage('§e已取消明日休店，餐厅正常营业！');
                server.runCommandSilent('say [餐厅] ' + playerName + ' 取消了明日休店');
            } else {
                writeSelectedRestDay(targetDay);
                player.sendSystemMessage('§a已设置明日休店！第' + targetDay + '天餐厅歇业。');
                server.runCommandSilent('say [餐厅] ' + playerName + ' 设置了明日休店（第' + targetDay + '天）');
            }
        } catch (error) {
            console.log('[餐厅] 次日安排处理错误: ' + error);
        }

        // 延时释放锁：500ms 后才允许下一次处理，挡住连续派发的重复事件
        lockTimer = setTimeout(() => {
            processingLock = false;
            lockTimer = null;
        }, 500);
    });

    // 清理旧键：用非 null 值覆盖，避免历史残留的 null 污染 global
    // （读取"键存在但值为 null"的条目会触发不可捕获的 Rhino NPE）
    try {
        global.selectedRestDay = -1;
        global.selectedRestDayNotified = -1;
    } catch (e) {
    }

})();
