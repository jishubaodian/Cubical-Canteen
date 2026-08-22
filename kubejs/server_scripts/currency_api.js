// ==================== 货币 API（玩家 NBT 存储）====================

function getBalance(player) {
    let nbt = player.persistentData;
    if (!nbt.contains('currency')) {
        nbt.putInt('currency', 0);  // 改用 putInt 替代 merge({currency: 0})
    }
    return nbt.getInt('currency');
}

function setBalance(player, amount) {
    let realAmount = Math.floor(amount);
    if (realAmount < 0) return false;
    player.persistentData.putInt('currency', realAmount);  // 改用 putInt
    console.log('[货币] ' + player.getName().getString() + ' 余额设置为 $' + realAmount);
    return true;
}

function addBalance(player, amount) {
    let realAmount = Math.floor(amount);
    if (realAmount <= 0) return false;
    let current = getBalance(player);
    player.persistentData.putInt('currency', current + realAmount);  // 改用 putInt
    console.log('[货币] ' + player.getName().getString() + ' +$' + realAmount);
    return true;
}

function takeBalance(player, amount) {
    let realAmount = Math.floor(amount);
    if (realAmount <= 0) return false;
    let current = getBalance(player);
    if (current < realAmount) {
        console.log('[货币] ' + player.getName().getString() + ' 余额不足');
        return false;
    }
    player.persistentData.putInt('currency', current - realAmount);  // 改用 putInt
    console.log('[货币] ' + player.getName().getString() + ' -$' + realAmount);
    return true;
}

// ... 其余函数保持不变