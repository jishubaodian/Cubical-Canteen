// ==================== 食材购买 FTB Quests 处理器（z1.3 购买入口）====================
// 每个食材在「食材购买」章节是一个 custom 任务（tag 形如 cc_buy_<命名空间>_<路径>）；
// 玩家点任务上的"检测/购买"按钮即触发本探测器（setCheckTimer 默认 0 = 仅手动，不会自动扣钱）。
// 探测器内：先校验声望门禁 -> 再校验余额 -> 足够则真实扣款(currency_api.takeBalance)并真实发放食材，
// 返回 true 完成任务；任意一步不满足返回 false，任务无法完成——从机制上杜绝"白嫖"(扣不起就不给物)。
// 任务 tag 与 config/ftbquests/quests/chapters/*.snbt 中 custom 任务的 tags 一一对应（见 BUY_TAGS）。
// 依赖：ingredient_registry.js（getIngredientCost / canBuyIngredient / getIngredientRepRequired）、
//       currency_api.js（takeBalance / hasEnough / formatCurrency）。

// 任务 tag -> 食材（id/cn 与 ingredient_registry.js 的 INGREDIENT_LIST 一致）
const BUY_TAGS = {
	"cc_buy_farmersdelight_pumpkin_slice": { id: "farmersdelight:pumpkin_slice", cn: "南瓜片" },
	"cc_buy_farmersdelight_cabbage": { id: "farmersdelight:cabbage", cn: "卷心菜" },
	"cc_buy_farmersdelight_cabbage_leaf": { id: "farmersdelight:cabbage_leaf", cn: "卷心菜叶" },
	"cc_buy_minecraft_glow_berries": { id: "minecraft:glow_berries", cn: "发光浆果" },
	"cc_buy_minecraft_brown_mushroom": { id: "minecraft:brown_mushroom", cn: "棕色蘑菇" },
	"cc_buy_farmersdelight_onion": { id: "farmersdelight:onion", cn: "洋葱" },
	"cc_buy_minecraft_kelp": { id: "minecraft:kelp", cn: "海带" },
	"cc_buy_minecraft_sweet_berries": { id: "minecraft:sweet_berries", cn: "甜浆果" },
	"cc_buy_minecraft_beetroot": { id: "minecraft:beetroot", cn: "甜菜根" },
	"cc_buy_farmersdelight_raw_pasta": { id: "farmersdelight:raw_pasta", cn: "生意面" },
	"cc_buy_farmersdelight_tomato": { id: "farmersdelight:tomato", cn: "番茄" },
	"cc_buy_farmersdelight_rice": { id: "farmersdelight:rice", cn: "稻米" },
	"cc_buy_minecraft_red_mushroom": { id: "minecraft:red_mushroom", cn: "红色蘑菇" },
	"cc_buy_minecraft_carrot": { id: "minecraft:carrot", cn: "胡萝卜" },
	"cc_buy_minecraft_apple": { id: "minecraft:apple", cn: "苹果" },
	"cc_buy_minecraft_melon_slice": { id: "minecraft:melon_slice", cn: "西瓜片" },
	"cc_buy_minecraft_egg": { id: "minecraft:egg", cn: "鸡蛋" },
	"cc_buy_minecraft_rabbit": { id: "minecraft:rabbit", cn: "生兔肉" },
	"cc_buy_minecraft_beef": { id: "minecraft:beef", cn: "生牛肉" },
	"cc_buy_minecraft_porkchop": { id: "minecraft:porkchop", cn: "生猪排" },
	"cc_buy_minecraft_mutton": { id: "minecraft:mutton", cn: "生羊肉" },
	"cc_buy_minecraft_chicken": { id: "minecraft:chicken", cn: "生鸡肉" },
	"cc_buy_farmersdelight_ham": { id: "farmersdelight:ham", cn: "火腿" },
	"cc_buy_farmersdelight_minced_beef": { id: "farmersdelight:minced_beef", cn: "牛肉馅" },
	"cc_buy_farmersdelight_bacon": { id: "farmersdelight:bacon", cn: "生培根" },
	"cc_buy_farmersdelight_mutton_chops": { id: "farmersdelight:mutton_chops", cn: "生羊排" },
	"cc_buy_minecraft_salmon": { id: "minecraft:salmon", cn: "生鲑鱼" },
	"cc_buy_minecraft_cod": { id: "minecraft:cod", cn: "生鳕鱼" },
	"cc_buy_farmersdelight_chicken_cuts": { id: "farmersdelight:chicken_cuts", cn: "生鸡肉丁" },
	"cc_buy_minecraft_pufferfish": { id: "minecraft:pufferfish", cn: "河豚" },
	"cc_buy_minecraft_tropical_fish": { id: "minecraft:tropical_fish", cn: "热带鱼" },
	"cc_buy_farmersdelight_salmon_slice": { id: "farmersdelight:salmon_slice", cn: "生鲑鱼片" },
	"cc_buy_farmersdelight_cod_slice": { id: "farmersdelight:cod_slice", cn: "生鳕鱼片" },
	"cc_buy_minecraft_chorus_fruit": { id: "minecraft:chorus_fruit", cn: "紫颂果" },
	"cc_buy_minecraft_golden_carrot": { id: "minecraft:golden_carrot", cn: "金胡萝卜" },
	"cc_buy_minecraft_golden_apple": { id: "minecraft:golden_apple", cn: "金苹果" },
	"cc_buy_minecraft_enchanted_golden_apple": { id: "minecraft:enchanted_golden_apple", cn: "附魔金苹果" },
};

FTBQuestsEvents.customTask(event => {
    let task = event.getTask();
    if (!task) return;

    // 从任务的 tags 中找到 cc_buy_* 那个（getId() 返回 long，故用 tag 匹配）
    let entry = null;
    try {
        let tags = task.getTags();
        if (tags) {
            let arr = tags.toArray();
            for (let i = 0; i < arr.length; i++) {
                let tg = String(arr[i]);
                if (BUY_TAGS[tg]) { entry = BUY_TAGS[tg]; break; }
            }
        }
    } catch (e) {
        console.log('[食材购买] 读取任务 tag 出错: ' + e);
    }
    if (!entry) return;                       // 非购买任务，跳过（不影响其他 custom 任务）

    event.setEnableButton(true);              // 显示"检测/购买"按钮，玩家主动点击才触发
    event.setCheckTimer(0);                   // 0 = 仅手动（玩家点按钮才跑检测），杜绝自动扣钱
    event.setMaxProgress(1);                  // 完成所需进度=1，检测时置 1 即完成

    event.setCheck((a, b) => {
        // KubeJS 把 JS 函数按位置映射到 Java SAM check(Data, ServerPlayer)；
        // 不同版本参数顺序、以及"完成信号"用 void 返回值还是 data.setProgress 可能不同。
        // 这里用能力探测定位 player / data，成功时扣款+发放+置进度，失败返回 false 且不置进度，双保险。
        let player = (a && typeof a.give === 'function') ? a
                   : (b && typeof b.give === 'function') ? b : null;
        let data   = (a && typeof a.setProgress === 'function') ? a
                   : (b && typeof b.setProgress === 'function') ? b : null;
        if (!player || !data) return false;

        try {
            // 1) 进价（权威值来自 ingredient_registry.js）
            let price = (typeof global.getIngredientCost === 'function') ? global.getIngredientCost(entry.id) : null;
            if (price == null) {
                player.sendSystemMessage('§c购买失败：未找到 ' + entry.cn + ' 的进价');
                return false;
            }
            // 2) 声望门禁（未达对应声望档不能买）
            if (typeof global.canBuyIngredient === 'function' && !global.canBuyIngredient(entry.id)) {
                let need = (typeof global.getIngredientRepRequired === 'function') ? global.getIngredientRepRequired(entry.id) : 0;
                player.sendSystemMessage('§c声望不足，购买 ' + entry.cn + ' 需声望 ' + need);
                return false;
            }
            // 3) 余额校验
            if (typeof global.hasEnough === 'function' && !global.hasEnough(player, price)) {
                player.sendSystemMessage('§c余额不足，购买 ' + entry.cn + ' 需 ' + global.formatCurrency(price));
                return false;
            }
            // 4) 真实扣款
            if (!global.takeBalance(player, price)) {
                player.sendSystemMessage('§c扣款失败，购买 ' + entry.cn + ' 未完成');
                return false;
            }
            // 5) 真实入库（每点一次购买 1 个）
            player.give(Item.of(entry.id, 1));
            player.sendSystemMessage('§a购买 ' + entry.cn + ' 花费 ' + global.formatCurrency(price) + '，已放入背包');
            data.setProgress(1);              // 双保险之一：进度置满 -> 完成
            return true;                      // 双保险之二：返回值（版本若采用则生效）
        } catch (e) {
            console.log('[食材购买] 处理 ' + entry.cn + ' 出错: ' + e);
            return false;
        }
    });
});

console.log('[食材购买] 处理器已加载，共 ' + Object.keys(BUY_TAGS).length + ' 个购买任务');
