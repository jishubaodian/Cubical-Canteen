// ==================== 货币 API（玩家 NBT 存储）====================
// 余额存在玩家 persistentData 的 currency 键，用 putInt / getInt / contains 读写。
// 不能用 nbt.currency = x 这种点号赋值，那只改 JS 内存，不会写进存档。

(function () {
    'use strict';

    console.log('[货币API] 加载中...');

    // ==================== 底层读写 ====================
    function getBalance(player) {
        try {
            if (!player) return 0;
            let nbt = player.persistentData;
            if (!nbt.contains('currency')) {
                nbt.putInt('currency', 0);
            }
            return nbt.getInt('currency');
        } catch (e) {
            console.log('[货币] getBalance 错误: ' + e);
            return 0;
        }
    }

    function setBalance(player, amount) {
        try {
            if (!player) return false;
            let realAmount = Math.floor(amount);
            if (isNaN(realAmount) || realAmount < 0) return false;
            player.persistentData.putInt('currency', realAmount);
            console.log('[货币] ' + player.getName().getString() + ' 余额设置为 $' + realAmount);
            return true;
        } catch (e) {
            console.log('[货币] setBalance 错误: ' + e);
            return false;
        }
    }

    // ==================== 业务接口 ====================
    function addBalance(player, amount) {
        try {
            if (!player) return false;
            let realAmount = Math.floor(amount);
            if (isNaN(realAmount) || realAmount <= 0) return false;
            let current = getBalance(player);
            player.persistentData.putInt('currency', current + realAmount);
            console.log('[货币] ' + player.getName().getString() + ' +$' + realAmount + '（当前 $' + (current + realAmount) + '）');
            return true;
        } catch (e) {
            console.log('[货币] addBalance 错误: ' + e);
            return false;
        }
    }

    function takeBalance(player, amount) {
        try {
            if (!player) return false;
            let realAmount = Math.floor(amount);
            if (isNaN(realAmount) || realAmount <= 0) return false;
            let current = getBalance(player);
            if (current < realAmount) {
                console.log('[货币] ' + player.getName().getString() + ' 余额不足（需 $' + realAmount + '，现有 $' + current + '）');
                return false;
            }
            player.persistentData.putInt('currency', current - realAmount);
            console.log('[货币] ' + player.getName().getString() + ' -$' + realAmount + '（剩余 $' + (current - realAmount) + '）');
            return true;
        } catch (e) {
            console.log('[货币] takeBalance 错误: ' + e);
            return false;
        }
    }

    // 只判断不扣钱：给"先校验再结算"的场景用，避免扣钱失败时才提示
    function hasEnough(player, amount) {
        try {
            let realAmount = Math.floor(amount);
            if (isNaN(realAmount) || realAmount <= 0) return true;
            return getBalance(player) >= realAmount;
        } catch (e) {
            console.log('[货币] hasEnough 错误: ' + e);
            return false;
        }
    }

    function formatCurrency(amount) {
        let v = Math.floor(amount);
        if (isNaN(v)) v = 0;
        return '$' + v;
    }

    // ==================== 玩家登录显示余额 ====================
    PlayerEvents.loggedIn(function (event) {
        try {
            let player = event.player;
            player.sendSystemMessage('§e当前余额: ' + formatCurrency(getBalance(player)));
        } catch (e) {
            console.log('[货币] 登录显示错误: ' + e);
        }
    });

    // ==================== 暴露到全局 ====================
    global.getBalance = getBalance;
    global.setBalance = setBalance;
    global.addBalance = addBalance;
    global.takeBalance = takeBalance;
    global.hasEnough = hasEnough;
    global.formatCurrency = formatCurrency;

    console.log('[货币API] 加载完成');
})();
