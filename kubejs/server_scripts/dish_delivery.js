// ==================== 菜品交付（任务 3.5 / 3.6）====================
// 玩家手持菜品右键顾客即可"上交"：校验是否为该顾客所点，正确则消耗 1 个、顾客满意离场；
// 错误则拒收并提示，顾客继续等待。交付时关注菜品品质（quality），品质影响顾客满意度与付款。
//
// 品质来源：读取手持物品 NBT 中的 cc_quality（整数）作为品质档位：
//   2 = 顶级, 1 = 优质, 0 / 缺省 = 普通, -1 = 劣质（如烤糊）。
// 若烹饪侧未写入该标签，一律按普通处理（满价付款）。付款只作提示，未接入货币系统。

(function() {
    'use strict';

    // 品质系数：key 为 cc_quality 取值，value 为订单价乘数
    const QUALITY_FACTOR = {
        '2': 1.5,   // 顶级
        '1': 1.2,   // 优质
        '0': 1.0,   // 普通
        '-1': 0.5   // 劣质
    };
    const QUALITY_NAME = {
        '2': '顶级',
        '1': '优质',
        '0': '普通',
        '-1': '劣质'
    };

    // 身份判断：用生成时写入的标记，不依赖 .type 字符串
    function isCustomer(entity) {
        try {
            if (entity && entity.persistentData && entity.persistentData.contains('cc_customer')) return true;
        } catch (e) {
        }
        return false;
    }

    // 读手持物品的品质档位（缺省普通）
    function getQuality(item) {
        try {
            let nbt = null;
            if (typeof item.getNbt === 'function') nbt = item.getNbt();
            if (!nbt && item.nbt) nbt = item.nbt;
            if (nbt && typeof nbt.contains === 'function' && nbt.contains('cc_quality')) {
                let q = nbt.getInt('cc_quality');
                if (QUALITY_FACTOR[String(q)] !== undefined) return q;
            }
        } catch (e) {
        }
        return 0;
    }

    // 消耗手持 1 个物品（兼容不同 KubeJS 版本的 API）
    function consumeOne(item) {
        try {
            if (typeof item.shrink === 'function') { item.shrink(1); return; }
        } catch (e) {
        }
        try {
            if (typeof item.count === 'number') { item.count = item.count - 1; return; }
        } catch (e) {
        }
        try {
            if (typeof item.setCount === 'function') { item.setCount(item.getCount() - 1); return; }
        } catch (e) {
        }
        console.log('[交付] 无法消耗物品（API 不匹配）');
    }

    ItemEvents.entityInteracted(function (event) {
        let target = event.getTarget();
        if (!isCustomer(target)) return;          // 只对顾客生效

        let player = event.getPlayer();
        if (!player) return;

        let order = null;
        try {
            if (typeof global.getCustomerOrder === 'function') order = global.getCustomerOrder(target);
        } catch (e) {
        }
        if (!order) return;

        // 已上菜：不再接收
        try {
            if (target.persistentData.contains('served')) {
                player.tell('顾客：我已经吃饱啦，谢谢！');
                return;
            }
        } catch (e) {
        }

        let item = event.getItem();
        if (!item || (typeof item.isEmpty === 'function' && item.isEmpty())) {
            player.tell('先把要上的菜拿在手里，再右键我。');
            return;
        }

        let heldId = '';
        try { heldId = item.getId(); } catch (e) {}
        if (!heldId) return;

        // 校验：必须是订单里的菜（主菜或饮品）
        let want = [order.main];
        if (order.drink) want.push(order.drink);
        let matched = false;
        for (let i = 0; i < want.length; i++) {
            if (want[i] && heldId === want[i]) { matched = true; break; }
        }
        if (!matched) {
            player.tell('顾客：这不是我点的菜……');
            return;                                // 不消耗物品，顾客继续等待
        }

        // 品质影响付款与反馈
        let q = getQuality(item);
        let factor = QUALITY_FACTOR[String(q)];
        if (factor === undefined) factor = 1.0;
        let qName = QUALITY_NAME[String(q)];
        if (qName === undefined) qName = '普通';
        let pay = Math.max(1, Math.round(order.price * factor));

        // 消耗 1 个并标记已上菜
        consumeOne(item);
        try { target.persistentData.putBoolean('served', true); } catch (e) {}
        try { event.cancel(); } catch (e) {}      // 阻止物品被原交互逻辑二次消耗

        // 反馈与离场
        player.tell('顾客：（' + qName + '）这就对啦！付你 $' + pay);
        console.log('[交付] 顾客收到 ' + heldId + ' 品质=' + qName + ' 付款=$' + pay);

        // 顾客满意离场
        try { target.discard(); } catch (e) {
            console.log('[交付] 顾客离场失败: ' + e);
        }
    });

    console.log('[交付] 菜品交付逻辑已加载');
})();
