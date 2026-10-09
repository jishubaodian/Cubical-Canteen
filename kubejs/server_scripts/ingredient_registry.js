// ==================== 食材注册表（z1.2 数据地基）====================
// 37 个食材的权威注册表：item id + 中文名 + 所属声望档 + FTB Quests 监听标签 + 进价。
// 声望门禁阈值与 reputation_api.js 的 SHOP_STAR_THRESHOLDS 完全一致（0/20/50/100/200），
// 即「玩家店铺星级 ≥ 食材档位」才可购买（z1.3 购买入口会调用本文件的 canBuyIngredient）。
// 进价档位 base/min/max 与「食材进价.md」策划定稿表完全一致（毛利保护 25%~40%，声望 5 档递增）。
// 注意：2.3 成本计算已撤回，本文件只提供「进价」供 z1.3 真实扣款读取，不自行推算成本。
// 「菜品 ↔ 所需食材」溯源映射依赖已撤回的 2.3，本阶段暂不建立（见 z1.2 规格，待 2.3 重做时补）。

// ==================== 声望档位（5 类，与 2.7 店铺星级阈值对齐）====================
const INGREDIENT_TIERS = {
    T1: { name: '基础食材', star: 1, repRequired: 0,   base: 2,  min: 1,  max: 4 },   // 初始可购
    T2: { name: '中等食材', star: 2, repRequired: 20,  base: 6,  min: 4,  max: 8 },   // 达 20 声望解锁
    T3: { name: '高级食材', star: 3, repRequired: 50,  base: 10, min: 8,  max: 15 },  // 达 50 声望解锁
    T4: { name: '特色食材', star: 4, repRequired: 100, base: 16, min: 12, max: 30 },  // 达 100 声望解锁
    T5: { name: '隐藏食材', star: 5, repRequired: 200, base: 30, min: 25, max: 80 }   // 达 200 声望解锁
};

// ==================== 食材主数据（id 为键，O(1) 查询）====================
// adjust：在档位 base 上的微调（默认 0）；最终进价 = clamp(base + adjust, min, max)
const INGREDIENT_LIST = [
    // —— T1 基础食材（rep 0，开局可购，base=2）——
    { id: 'farmersdelight:pumpkin_slice',  cn: '南瓜片',   tier: 'T1', listener: 'cc_buy_farmersdelight_pumpkin_slice',  adjust: 0 },   // 2
    { id: 'farmersdelight:cabbage',        cn: '卷心菜',   tier: 'T1', listener: 'cc_buy_farmersdelight_cabbage',        adjust: 0 },   // 2
    { id: 'farmersdelight:cabbage_leaf',   cn: '卷心菜叶', tier: 'T1', listener: 'cc_buy_farmersdelight_cabbage_leaf',   adjust: -1 },  // 1
    { id: 'minecraft:glow_berries',        cn: '发光浆果', tier: 'T1', listener: 'cc_buy_minecraft_glow_berries',        adjust: 1 },   // 3
    { id: 'minecraft:brown_mushroom',      cn: '棕色蘑菇', tier: 'T1', listener: 'cc_buy_minecraft_brown_mushroom',      adjust: -1 },  // 1
    { id: 'farmersdelight:onion',          cn: '洋葱',     tier: 'T1', listener: 'cc_buy_farmersdelight_onion',          adjust: 0 },   // 2
    { id: 'minecraft:kelp',                cn: '海带',     tier: 'T1', listener: 'cc_buy_minecraft_kelp',                adjust: -1 },  // 1
    { id: 'minecraft:sweet_berries',       cn: '甜浆果',   tier: 'T1', listener: 'cc_buy_minecraft_sweet_berries',       adjust: 0 },   // 2
    { id: 'minecraft:beetroot',            cn: '甜菜根',   tier: 'T1', listener: 'cc_buy_minecraft_beetroot',            adjust: 0 },   // 2
    { id: 'farmersdelight:raw_pasta',      cn: '生意面',   tier: 'T1', listener: 'cc_buy_farmersdelight_raw_pasta',       adjust: 1 },   // 3
    { id: 'farmersdelight:tomato',         cn: '番茄',     tier: 'T1', listener: 'cc_buy_farmersdelight_tomato',         adjust: 0 },   // 2
    { id: 'farmersdelight:rice',           cn: '稻米',     tier: 'T1', listener: 'cc_buy_farmersdelight_rice',           adjust: 0 },   // 2
    { id: 'minecraft:red_mushroom',        cn: '红色蘑菇', tier: 'T1', listener: 'cc_buy_minecraft_red_mushroom',        adjust: -1 },  // 1
    { id: 'minecraft:carrot',              cn: '胡萝卜',   tier: 'T1', listener: 'cc_buy_minecraft_carrot',              adjust: -1 },  // 1
    { id: 'minecraft:apple',               cn: '苹果',     tier: 'T1', listener: 'cc_buy_minecraft_apple',               adjust: 1 },   // 3
    { id: 'minecraft:melon_slice',         cn: '西瓜片',   tier: 'T1', listener: 'cc_buy_minecraft_melon_slice',         adjust: 0 },   // 2
    { id: 'minecraft:egg',                 cn: '鸡蛋',     tier: 'T1', listener: 'cc_buy_minecraft_egg',                 adjust: -1 },  // 1

    // —— T2 中等食材（rep 20，base=6）——
    { id: 'minecraft:rabbit',              cn: '生兔肉',   tier: 'T2', listener: 'cc_buy_minecraft_rabbit',               adjust: -1 },  // 5
    { id: 'minecraft:beef',                cn: '生牛肉',   tier: 'T2', listener: 'cc_buy_minecraft_beef',                 adjust: 1 },   // 7
    { id: 'minecraft:porkchop',            cn: '生猪排',   tier: 'T2', listener: 'cc_buy_minecraft_porkchop',             adjust: 0 },   // 6
    { id: 'minecraft:mutton',              cn: '生羊肉',   tier: 'T2', listener: 'cc_buy_minecraft_mutton',               adjust: 0 },   // 6
    { id: 'minecraft:chicken',             cn: '生鸡肉',   tier: 'T2', listener: 'cc_buy_minecraft_chicken',              adjust: -1 },  // 5

    // —— T3 高级食材（rep 50，base=10）——
    { id: 'farmersdelight:ham',            cn: '火腿',     tier: 'T3', listener: 'cc_buy_farmersdelight_ham',             adjust: 0 },   // 10
    { id: 'farmersdelight:minced_beef',    cn: '牛肉馅',   tier: 'T3', listener: 'cc_buy_farmersdelight_minced_beef',     adjust: -1 },  // 9
    { id: 'farmersdelight:bacon',          cn: '生培根',   tier: 'T3', listener: 'cc_buy_farmersdelight_bacon',           adjust: 0 },   // 10
    { id: 'farmersdelight:mutton_chops',   cn: '生羊排',   tier: 'T3', listener: 'cc_buy_farmersdelight_mutton_chops',    adjust: -1 },  // 9
    { id: 'minecraft:salmon',              cn: '生鲑鱼',   tier: 'T3', listener: 'cc_buy_minecraft_salmon',               adjust: 2 },   // 12
    { id: 'minecraft:cod',                 cn: '生鳕鱼',   tier: 'T3', listener: 'cc_buy_minecraft_cod',                  adjust: -2 },  // 8
    { id: 'farmersdelight:chicken_cuts',   cn: '生鸡肉丁', tier: 'T3', listener: 'cc_buy_farmersdelight_chicken_cuts',    adjust: -1 },  // 9

    // —— T4 特色食材（rep 100，base=16）——
    { id: 'minecraft:pufferfish',          cn: '河豚',     tier: 'T4', listener: 'cc_buy_minecraft_pufferfish',           adjust: 9 },   // 25
    { id: 'minecraft:tropical_fish',       cn: '热带鱼',   tier: 'T4', listener: 'cc_buy_minecraft_tropical_fish',        adjust: -1 },  // 15
    { id: 'farmersdelight:salmon_slice',   cn: '生鲑鱼片', tier: 'T4', listener: 'cc_buy_farmersdelight_salmon_slice',    adjust: 2 },   // 18
    { id: 'farmersdelight:cod_slice',      cn: '生鳕鱼片', tier: 'T4', listener: 'cc_buy_farmersdelight_cod_slice',       adjust: -2 },  // 14
    { id: 'minecraft:chorus_fruit',        cn: '紫颂果',   tier: 'T4', listener: 'cc_buy_minecraft_chorus_fruit',         adjust: 4 },   // 20

    // —— T5 隐藏食材（rep 200，base=30）——
    { id: 'minecraft:golden_carrot',       cn: '金胡萝卜', tier: 'T5', listener: 'cc_buy_minecraft_golden_carrot',        adjust: -5 },  // 25
    { id: 'minecraft:golden_apple',        cn: '金苹果',   tier: 'T5', listener: 'cc_buy_minecraft_golden_apple',         adjust: 10 },  // 40
    { id: 'minecraft:enchanted_golden_apple', cn: '附魔金苹果', tier: 'T5', listener: 'cc_buy_minecraft_enchanted_golden_apple', adjust: 20 } // 50
];

// id → 记录 的索引表
const INGREDIENT_DATA = {};
INGREDIENT_LIST.forEach(it => {
    if (INGREDIENT_DATA[it.id]) console.log('[食材注册表] 重复 id: ' + it.id);
    INGREDIENT_DATA[it.id] = it;
});

// ==================== 查询 API ====================
function getIngredient(id) {
    return INGREDIENT_DATA[id] || null;
}

function getIngredientTier(id) {
    let ing = INGREDIENT_DATA[id];
    if (!ing) return null;
    return INGREDIENT_TIERS[ing.tier] || null;
}

// 进价 = clamp(base + adjust, min, max)，整数；z1.3 真实扣款读取此值
function getIngredientCost(id) {
    let ing = INGREDIENT_DATA[id];
    if (!ing) {
        console.log('[食材注册表] 未找到食材 "' + id + '"');
        return null;
    }
    let tier = INGREDIENT_TIERS[ing.tier];
    if (!tier) {
        console.log('[食材注册表] 档位 "' + ing.tier + '" 不存在');
        return null;
    }
    let price = tier.base + (ing.adjust || 0);
    if (price < tier.min) price = tier.min;
    if (price > tier.max) price = tier.max;
    return Math.floor(price);
}

// 建议进价区间（来自档位 min/max），供 UI / 策划参考
function getIngredientPriceRange(id) {
    let tier = getIngredientTier(id);
    if (!tier) return null;
    return { min: tier.min, max: tier.max };
}

function getIngredientListener(id) {
    let ing = INGREDIENT_DATA[id];
    return ing ? ing.listener : null;
}

function getIngredientStar(id) {
    let tier = getIngredientTier(id);
    return tier ? tier.star : null;
}

// 购买所需声望（门禁阈值）
function getIngredientRepRequired(id) {
    let tier = getIngredientTier(id);
    return tier ? tier.repRequired : null;
}

// 安全取声望：依赖 reputation_api.js 的 global.getReputation（无参，读主世界持久化）
function safeGetRep() {
    try {
        if (typeof global.getReputation === 'function') return global.getReputation();
    } catch (e) {
        console.log('[食材注册表] 读取声望失败: ' + e);
    }
    return 0;
}

// 声望门禁：rep 可选，缺省用当前声望；店铺星级 ≥ 食材档位才可买
function canBuyIngredient(id, rep) {
    let tier = getIngredientTier(id);
    if (!tier) return false;
    let r = (rep === undefined || rep === null) ? safeGetRep() : Math.floor(rep);
    return r >= tier.repRequired;
}

// 给定一个声望值，返回当前可购买的食材 id 列表（z1.3 构建购买池用）
function getBuyableIngredientIds(rep) {
    let r = (rep === undefined || rep === null) ? safeGetRep() : Math.floor(rep);
    let out = [];
    for (let id in INGREDIENT_DATA) {
        let tier = INGREDIENT_TIERS[INGREDIENT_DATA[id].tier];
        if (tier && r >= tier.repRequired) out.push(id);
    }
    return out;
}

// 按档位返回食材列表（含进价），供展示 / FTB Quests 生成
function getIngredientsByTier(tier) {
    let result = [];
    INGREDIENT_LIST.forEach(it => {
        if (it.tier === tier) {
            result.push({
                id: it.id,
                cn: it.cn,
                listener: it.listener,
                cost: getIngredientCost(it.id),
                repRequired: INGREDIENT_TIERS[tier].repRequired
            });
        }
    });
    return result;
}

// ==================== 暴露到全局 ====================
global.getIngredient = getIngredient;
global.getIngredientTier = getIngredientTier;
global.getIngredientCost = getIngredientCost;
global.getIngredientPriceRange = getIngredientPriceRange;
global.getIngredientListener = getIngredientListener;
global.getIngredientStar = getIngredientStar;
global.getIngredientRepRequired = getIngredientRepRequired;
global.canBuyIngredient = canBuyIngredient;
global.getBuyableIngredientIds = getBuyableIngredientIds;
global.getIngredientsByTier = getIngredientsByTier;
global.INGREDIENT_TIERS = INGREDIENT_TIERS;
global.INGREDIENT_DATA = INGREDIENT_DATA;
global.INGREDIENT_LIST = INGREDIENT_LIST;

console.log('[食材注册表] 已加载，共 ' + INGREDIENT_LIST.length + ' 个食材，分 5 档（声望 0/20/50/100/200）');
console.log('[食材注册表] 使用 global.getIngredientCost(id) 读进价，global.canBuyIngredient(id) 判门禁');
