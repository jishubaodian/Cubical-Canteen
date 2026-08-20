// ==================== 定价档位定义 ====================
const PRICE_TIERS = {
    BASIC: {
        name: '基础菜',
        min: 8,
        max: 12,
        base: 10
    },
    MEDIUM: {
        name: '中等菜',
        min: 20,
        max: 35,
        base: 27.5
    },
    HIGH: {
        name: '高级菜',
        min: 50,
        max: 80,
        base: 65
    },
    DRINK: {
        name: '饮品',
        min: 3,
        max: 5,
        base: 4
    }
};

const DISH_DATA = {};

// ==================== 查询 API ====================
function getDishPrice(dishId) {
    let dish = DISH_DATA[dishId];
    if (!dish) {
        console.log(`[定价] 未找到菜品 "${dishId}"`);
        return null;
    }
    if (dish.exactPrice !== undefined) {
        return dish.exactPrice;
    }
    let tier = PRICE_TIERS[dish.tier];
    if (!tier) {
        console.log(`[定价] 档位 "${dish.tier}" 不存在`);
        return null;
    }
    let price = tier.base + dish.adjust;
    if (price < tier.min) price = tier.min;
    if (price > tier.max) price = tier.max;
    return Math.floor(price);
}

function getDishTier(dishId) {
    let dish = DISH_DATA[dishId];
    if (!dish) return null;
    if (dish.exactPrice !== undefined) {
        return { tier: '特殊', name: '特殊定价', price: dish.exactPrice };
    }
    return {
        tier: dish.tier,
        name: PRICE_TIERS[dish.tier] ? PRICE_TIERS[dish.tier].name : '未知',
        price: getDishPrice(dishId)
    };
}

function getDishesByTier(tier) {
    let result = [];
    for (let id in DISH_DATA) {
        let dish = DISH_DATA[id];
        if (dish.exactPrice !== undefined) continue;
        if (dish.tier === tier) {
            result.push({
                id: id,
                price: getDishPrice(id),
                adjust: dish.adjust
            });
        }
    }
    return result;
}

function getTierInfo(tier) {
    return PRICE_TIERS[tier] || null;
}

function registerDish(dishId, tier, adjust, exactPrice) {
    if (exactPrice !== undefined && exactPrice !== null) {
        DISH_DATA[dishId] = { exactPrice: Math.floor(exactPrice) };
        console.log(`[定价] 注册菜品: ${dishId} -> 特殊定价 $${Math.floor(exactPrice)}`);
        return true;
    }
    if (DISH_DATA[dishId]) {
        console.log(`[定价] 菜品 "${dishId}" 已存在，将被覆盖`);
    }
    let tierInfo = PRICE_TIERS[tier];
    if (!tierInfo) {
        console.log(`[定价] 档位 "${tier}" 不存在，可选: BASIC, MEDIUM, HIGH, DRINK`);
        return false;
    }
    let price = tierInfo.base + adjust;
    if (price < tierInfo.min || price > tierInfo.max) {
        console.log(`[定价] 菜品 "${dishId}" 售价 ${Math.floor(price)} 超出档位范围，已修正`);
        if (price < tierInfo.min) adjust = tierInfo.min - tierInfo.base;
        if (price > tierInfo.max) adjust = tierInfo.max - tierInfo.base;
    }
    DISH_DATA[dishId] = { tier: tier, adjust: adjust };
    console.log(`[定价] 注册菜品: ${dishId} -> ${tier} $${getDishPrice(dishId)}`);
    return true;
}

// ==================== 批量注册所有菜品 ====================
const ALL_DISHES = [
    // 基础菜（$8 ~ $12）
    { id: 'cuisinedelight:fried_mushroom', tier: 'BASIC', adjust: -2 },
    { id: 'cuisinedelight:scrambled_egg_and_tomato', tier: 'BASIC', adjust: 0 },
    { id: 'cuisinedelight:fried_rice', tier: 'BASIC', adjust: -2 },
    { id: 'cuisinedelight:vegetable_fried_rice', tier: 'BASIC', adjust: -1 },
    { id: 'cuisinedelight:vegetable_pasta', tier: 'BASIC', adjust: -1 },
    { id: 'cuisinedelight:vegetable_platter', tier: 'BASIC', adjust: 2 },

    // 中等菜（$20 ~ $35）
    { id: 'cuisinedelight:fried_meat_and_melon', tier: 'MEDIUM', adjust: -5.5 },
    { id: 'cuisinedelight:fried_pasta', tier: 'MEDIUM', adjust: -7.5 },
    { id: 'cuisinedelight:ham_fried_rice', tier: 'MEDIUM', adjust: -3.5 },
    { id: 'cuisinedelight:meat_fried_rice', tier: 'MEDIUM', adjust: -5.5 },
    { id: 'cuisinedelight:meat_pasta', tier: 'MEDIUM', adjust: -2.5 },
    { id: 'cuisinedelight:meat_with_vegetables', tier: 'MEDIUM', adjust: -3.5 },
    { id: 'cuisinedelight:mixed_fried_rice', tier: 'MEDIUM', adjust: 0.5 },
    { id: 'cuisinedelight:mixed_pasta', tier: 'MEDIUM', adjust: 0.5 },
    { id: 'cuisinedelight:seafood_with_vegetables', tier: 'MEDIUM', adjust: 2.5 },

    // 高级菜（$50 ~ $80）
    { id: 'cuisinedelight:meat_platter', tier: 'HIGH', adjust: -10 },
    { id: 'cuisinedelight:meat_with_seafood', tier: 'HIGH', adjust: 0 },
    { id: 'cuisinedelight:seafood_fried_rice', tier: 'HIGH', adjust: -15 },
    { id: 'cuisinedelight:seafood_pasta', tier: 'HIGH', adjust: -13 },
    { id: 'cuisinedelight:seafood_platter', tier: 'HIGH', adjust: 5 },

    // 特殊菜品
    { id: 'cuisinedelight:suspicious_mix', exactPrice: 0 }
];

ALL_DISHES.forEach(dish => {
    if (dish.exactPrice !== undefined) {
        registerDish(dish.id, null, 0, dish.exactPrice);
    } else {
        registerDish(dish.id, dish.tier, dish.adjust);
    }
});

// ==================== 暴露到全局 ====================
global.getDishPrice = getDishPrice;
global.getDishTier = getDishTier;
global.getDishesByTier = getDishesByTier;
global.getTierInfo = getTierInfo;
global.registerDish = registerDish;
global.DISH_DATA = DISH_DATA;
global.PRICE_TIERS = PRICE_TIERS;

console.log('[定价] 定价档位表已加载');
console.log('[定价] 基础菜: $8-$12, 中等菜: $20-$35, 高级菜: $50-$80, 饮品: $3-$5');
console.log('[定价] 使用 global.getDishPrice(dishId) 查询售价');