(function() {
    'use strict';

    // ==================== FTB Quests 次日安排处理器 ====================

    let processingLock = false;
    let lockTimer = null;

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
            let level = server.getLevel('minecraft:overworld');
            if (!level) {
                processingLock = false;
                return;
            }

            let dayTime = level.getDayTime();
            let moment = dayTime % 24000;
            let dayCount = Math.floor(dayTime / 24000);
            let nextDayIsForcedRest = ((dayCount + 1) % 5 === 0);

            // 可操作时段：收尾期（18:00-20:00）和歇业期（20:00-次日5:00）
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

            let targetDay = dayCount + 1;
            if (global.selectedRestDay === targetDay) {
                global.selectedRestDay = -1;
                player.sendSystemMessage('§e已取消明日休店，餐厅正常营业！');
                server.runCommand('say [餐厅] ' + player.getName().getString() + ' 取消了明日休店');
            } else {
                global.selectedRestDay = targetDay;
                global.selectedRestDayNotified = -1;
                player.sendSystemMessage('§a已设置明日休店！第' + targetDay + '天餐厅歇业。');
                server.runCommand('say [餐厅] ' + player.getName().getString() + ' 设置了明日休店（第' + targetDay + '天）');
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

})();