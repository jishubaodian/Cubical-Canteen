// ==================== 订单生成算法（任务 3.4）====================
// 每位顾客生成时随机生成一份订单：1 道主菜 + 0~1 道饮品（50% 概率）。
// 菜品池来自 dish_pricing.js 的档位表，订单写入顾客 persistentData，
// 供交付校验（3.6）与头顶显示（3.3）读取。
//
// 注意：当前定价表里没有 DRINK 档位的菜品，所以饮品池为空、订单只有主菜。
// 需要饮品时往 dish_pricing.js 的 ALL_DISHES 里补 DRINK 档位即可，这里不用改。

(function() {
    'use strict';

    let DRINK_CHANCE = 0.5;

    // 主菜档位权重：V1 固定，等店铺星级系统（2.7）再按星级调整
    let MAIN_TIER_WEIGHTS = [
        { tier: 'BASIC', weight: 70 },
        { tier: 'MEDIUM', weight: 25 },
        { tier: 'HIGH', weight: 5 }
    ];

    let mainPool = null;
    let drinkPool = null;

    // ==================== 菜品池 ====================
    function buildPool(tiers) {
        let pool = [];
        try {
            for (let i = 0; i < tiers.length; i++) {
                let list = global.getDishesByTier(tiers[i]);
                if (!list) continue;
                for (let j = 0; j < list.length; j++) {
                    let d = list[j];
                    // 跳过售价为 0 或取不到价的特殊菜
                    if (d && d.id && d.price > 0) pool.push(d);
                }
            }
        } catch (e) {
            console.log('[订单] 读取菜品池失败: ' + e);
        }
        return pool;
    }

    function getMainPool() {
        if (mainPool === null) {
            let tiers = [];
            for (let i = 0; i < MAIN_TIER_WEIGHTS.length; i++) {
                tiers.push(MAIN_TIER_WEIGHTS[i].tier);
            }
            mainPool = buildPool(tiers);
            console.log('[订单] 主菜池 ' + mainPool.length + ' 道');
        }
        return mainPool;
    }

    function getDrinkPool() {
        if (drinkPool === null) {
            drinkPool = buildPool(['DRINK']);
            console.log('[订单] 饮品池 ' + drinkPool.length + ' 道');
        }
        return drinkPool;
    }

    // ==================== 随机选择 ====================
    function pickOne(pool) {
        if (!pool || pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function pickMainTier() {
        let total = 0;
        for (let i = 0; i < MAIN_TIER_WEIGHTS.length; i++) {
            total += MAIN_TIER_WEIGHTS[i].weight;
        }
        let r = Math.random() * total;
        for (let i = 0; i < MAIN_TIER_WEIGHTS.length; i++) {
            r -= MAIN_TIER_WEIGHTS[i].weight;
            if (r <= 0) return MAIN_TIER_WEIGHTS[i].tier;
        }
        return MAIN_TIER_WEIGHTS[MAIN_TIER_WEIGHTS.length - 1].tier;
    }

    // ==================== 生成订单 ====================
    global.generateOrder = function () {
        let tier = pickMainTier();
        let main = pickOne(buildPool([tier]));
        if (!main) {
            // 该档位没有菜时退回整个主菜池再试一次
            main = pickOne(getMainPool());
        }
        if (!main) return null;

        let drink = null;
        if (Math.random() < DRINK_CHANCE) {
            drink = pickOne(getDrinkPool());
        }

        return {
            main: main.id,
            drink: drink ? drink.id : null,
            price: main.price + (drink ? drink.price : 0),
            tier: tier
        };
    };

    // ==================== 读写顾客身上的订单 ====================
    // 用扁平键存（order_main / order_drink / order_price），读取统一走 getCustomerOrder()
    global.assignOrder = function (entity) {
        let order = global.generateOrder();
        if (!order) return null;
        try {
            let nbt = entity.persistentData;
            nbt.putString('order_main', order.main);
            nbt.putString('order_drink', order.drink === null ? '' : order.drink);
            nbt.putInt('order_price', order.price);
        } catch (e) {
            console.log('[订单] 写入订单失败: ' + e);
        }
        return order;
    };

    global.getCustomerOrder = function (entity) {
        try {
            let nbt = entity.persistentData;
            if (!nbt || !nbt.contains('order_main')) return null;
            let drink = nbt.getString('order_drink');
            return {
                main: nbt.getString('order_main'),
                drink: drink ? drink : null,
                price: nbt.getInt('order_price')
            };
        } catch (e) {
            return null;
        }
    };

    // ==================== 订单展示文本 ====================
    // 读取顾客身上的订单，拼成头顶显示用的多行文本（任务 3.3）。
    // 菜品显示名优先取物品注册表的中文名；取不到时退化为可读 ID，保证不出空。
    // 中文显示名映射：注册表取不到中文（如英文客户端）时的兜底，可自行修改
    const DISH_NAMES = {
        'cuisinedelight:fried_mushroom': '炒蘑菇',
        'cuisinedelight:scrambled_egg_and_tomato': '番茄炒蛋',
        'cuisinedelight:fried_rice': '蛋炒饭',
        'cuisinedelight:vegetable_fried_rice': '蔬菜炒饭',
        'cuisinedelight:vegetable_pasta': '蔬菜意面',
        'cuisinedelight:vegetable_platter': '蔬菜拼盘',
        'cuisinedelight:fried_meat_and_melon': '苦瓜炒肉',
        'cuisinedelight:fried_pasta': '炒意面',
        'cuisinedelight:ham_fried_rice': '火腿炒饭',
        'cuisinedelight:meat_fried_rice': '肉炒饭',
        'cuisinedelight:meat_pasta': '肉酱意面',
        'cuisinedelight:meat_with_vegetables': '肉炒蔬菜',
        'cuisinedelight:mixed_fried_rice': '什锦炒饭',
        'cuisinedelight:mixed_pasta': '什锦意面',
        'cuisinedelight:seafood_with_vegetables': '海鲜炒蔬菜',
        'cuisinedelight:meat_platter': '肉拼盘',
        'cuisinedelight:meat_with_seafood': '肉炒海鲜',
        'cuisinedelight:seafood_fried_rice': '海鲜炒饭',
        'cuisinedelight:seafood_pasta': '海鲜意面',
        'cuisinedelight:seafood_platter': '海鲜拼盘',
        'cuisinedelight:suspicious_mix': '可疑料理'
    };

    function dishName(dishId) {
        if (!dishId) return '';
        // 优先取注册表名称：游戏语言为中文时即为模组准确中文名
        try {
            let comp = Item.of(dishId).getName();
            let s = (typeof comp.getString === 'function') ? comp.getString() : String(comp);
            if (s && /[\u4e00-\u9fff]/.test(s)) return s.trim();
        } catch (e) {
        }
        // 英文客户端等取不到中文时，用内置中文名兜底
        if (DISH_NAMES[dishId]) return DISH_NAMES[dishId];
        // 兜底：可读 ID
        let raw = String(dishId).split(':').pop();
        return raw.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    // 头顶只显示菜名：用户要求不要"顾客"/"订单"等任何前缀，纯菜名即可
    global.getOrderDisplayText = function (entity) {
        let order = global.getCustomerOrder(entity);
        if (!order) return null;
        // 纯中文菜名，多道菜换行；不用 emoji / 特殊符号（MC 默认字体无法渲染）
        let lines = [];
        let main = dishName(order.main);
        if (main) lines.push(main);
        if (order.drink) {
            let d = dishName(order.drink);
            if (d) lines.push(d);
        }
        return lines.length > 0 ? lines.join('\n') : null;
    };

    console.log('[订单API] 已加载');
})();
