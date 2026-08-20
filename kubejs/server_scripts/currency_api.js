(function() {
    'use strict';

    // ==================== 货币 API（玩家 NBT 存储）====================

    function getBalance(player) {
        let nbt = player.persistentData;
        if (!nbt.contains('currency')) {
            nbt.merge({currency: 0});
        }
        return nbt.getInt('currency');
    }

    function setBalance(player, amount) {
        let realAmount = Math.floor(amount);
        if (realAmount < 0) return false;
        player.persistentData.merge({currency: realAmount});
        console.log(`[货币] ${player.getName().getString()} 余额设置为 $${realAmount}`);
        return true;
    }

    function addBalance(player, amount) {
        let realAmount = Math.floor(amount);
        if (realAmount <= 0) return false;
        let current = getBalance(player);
        player.persistentData.merge({currency: current + realAmount});
        console.log(`[货币] ${player.getName().getString()} +$${realAmount}`);
        return true;
    }

    function takeBalance(player, amount) {
        let realAmount = Math.floor(amount);
        if (realAmount <= 0) return false;
        let current = getBalance(player);
        if (current < realAmount) {
            console.log(`[货币] ${player.getName().getString()} 余额不足`);
            return false;
        }
        player.persistentData.merge({currency: current - realAmount});
        console.log(`[货币] ${player.getName().getString()} -$${realAmount}`);
        return true;
    }

    function formatCurrency(amount) {
        return '$' + Math.floor(amount);
    }

    // ==================== 玩家登录显示余额 ====================
    PlayerEvents.loggedIn(event => {
        let player = event.player;
        player.sendSystemMessage(`§e当前余额: ${formatCurrency(getBalance(player))}`);
    });

    // ==================== 暴露到全局 ====================
    global.getBalance = getBalance;
    global.setBalance = setBalance;
    global.addBalance = addBalance;
    global.takeBalance = takeBalance;
    global.formatCurrency = formatCurrency;

    console.log('[货币API] 已加载');
})();