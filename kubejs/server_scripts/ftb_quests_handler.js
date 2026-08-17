(function() {
    'use strict';

    // ==================== FTB Quests 次日安排处理器 ====================

    FTBQuestsEvents.completed(event => {
        let quest = event.getObject();
        let player = event.player;

        if (!quest.hasTag('rest_day_toggle')) {
            return;
        }

        let server = player.getServer();
        let level = server.getLevel('minecraft:overworld');
        if (!level) return;

        let dayTime = level.getDayTime();
        let moment = dayTime % 24000;
        let dayCount = Math.floor(dayTime / 24000);
        let nextDayIsForcedRest = ((dayCount + 1) % 5 === 0);

        // 可操作时段：收尾期（18:00-20:00）和歇业期（20:00-次日5:00）
        let canOperate = (moment >= 12000);

        if (!canOperate) {
            player.sendSystemMessage('§c当前时段不可操作，请在收尾期（18:00-20:00）或歇业期操作！');
            return;
        }

        if (nextDayIsForcedRest) {
            player.sendSystemMessage('§c明日为法定休店日，无需设置！');
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
    });

})();