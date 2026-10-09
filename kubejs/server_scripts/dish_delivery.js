(function() {
    'use strict';

    // 是否启用 5 星小费（任务 2.8）；关掉后 5 星不再额外给钱
    const TIP_ENABLED = true;

    // 品质阈值（百分制，可在实测后微调；详见变更记录 015）：
    //   ≥80 → 顶级(×1.5) / ≥60 → 优质(×1.2) / ≥40 → 普通(×1.0) / <40 → 劣质(×0.5)
    // 若读取到的 score 是 0~2 的小数（极少数情况），会自动 ×50 归一到百分制。
    const QUALITY_TIERS = [
        { min: 80, key: '2',  name: '顶级', factor: 1.5 },
        { min: 60, key: '1',  name: '优质', factor: 1.2 },
        { min: 40, key: '0',  name: '普通', factor: 1.0 },
        { min: -1, key: '-1', name: '劣质', factor: 0.5 }
    ];

    // 仅打一次的品质探针日志，便于核对真实 NBT 路径与数值区间，避免"改了还是不对"
    let qualityProbeLogged = false;

    // 身份判断：用生成时写入的标记，不依赖 .type 字符串
    function isCustomer(entity) {
        try {
            if (entity && entity.persistentData && entity.persistentData.contains('cc_customer')) return true;
        } catch (e) {
        }
        return false;
    }

    // 读一个 NBT Tag 的数值（兼容 int/short/long/float/double/byte/string 各种类型）
    function readNumericTag(t) {
        try {
            if (t && typeof t.getId === 'function') {
                var id = t.getId();
                if (id >= 1 && id <= 6) {                 // 数值型 leaf
                    if (typeof t.getAsDouble === 'function') return t.getAsDouble();
                    if (typeof t.getDouble === 'function') return t.getDouble();
                    if (typeof t.getAsInt === 'function') return t.getAsInt();
                }
                if (id === 8) {                           // string：尝试转数字
                    var s = (typeof t.getAsString === 'function') ? t.getAsString() : null;
                    if (s != null) { var n = Number(s); if (!isNaN(n)) return n; }
                }
            }
        } catch (e) {}
        return null;
    }

    // 在复合标签里递归找 "score" 键（兜底方案，应对 l2serial 可能的嵌套差异）
    function findScoreInTag(tag) {
        if (!tag || typeof tag.getId !== 'function' || tag.getId() !== 10) return null;
        if (typeof tag.getAllKeys !== 'function') return null;
        var keys;
        try { keys = tag.getAllKeys().toArray(); }
        catch (e) { try { var it = tag.getAllKeys().iterator(); var a = []; while (it.hasNext()) a.push(it.next()); keys = a; } catch (e2) { return null; } }
        // 第一遍：直接名为 score 的键
        for (var i = 0; i < keys.length; i++) {
            var k = String(keys[i]);
            if (k === 'score') {
                var v = readNumericTag(tag.get(k));
                if (v !== null && !isNaN(v)) return v;
            }
        }
        // 第二遍：递归子复合标签
        for (var i = 0; i < keys.length; i++) {
            var k = String(keys[i]);
            if (k === 'CookedFoodData') continue;         // 由直读路径处理，避免重复
            var child = tag.get(k);
            if (child && typeof child.getId === 'function' && child.getId() === 10) {
                var v = findScoreInTag(child);
                if (v !== null) return v;
            }
        }
        return null;
    }

    // 从料理乐事成品 NBT 的 CookedFoodData 复合标签里读 score（首选路径）
    function readScoreDirect(nbt) {
        var sub = null;
        try { if (nbt && typeof nbt.getCompound === 'function') sub = nbt.getCompound('CookedFoodData'); } catch (e) {}
        if (!sub || typeof sub.contains !== 'function') return undefined;   // 没有该复合标签
        if (!sub.contains('score')) return undefined;                       // 复合标签里没有 score
        // 逐个 getter 尝试，命中非 0 即返回；全为 0 说明品质确实为 0%
        var getters = ['getInt', 'getShort', 'getLong', 'getFloat', 'getDouble', 'getByte'];
        for (var i = 0; i < getters.length; i++) {
            try { if (typeof sub[getters[i]] === 'function') { var v = sub[getters[i]]('score'); if (typeof v === 'number' && v !== 0) return v; } } catch (e) {}
        }
        return 0;   // 真的就是 0%
    }

    // 把百分制分数映射到品质档位（score 为 null/undefined 时按"普通"占位）
    function scoreToTier(score) {
        if (score === null || score === undefined || isNaN(score)) {
            return { key: '0', name: '普通', factor: 1.0, raw: null };
        }
        var pct = score;
        if (pct > 0 && pct <= 2) pct = pct * 50;          // 极小概率读到 0~2 小数，归一化
        for (var i = 0; i < QUALITY_TIERS.length; i++) {
            if (pct >= QUALITY_TIERS[i].min) return { key: QUALITY_TIERS[i].key, name: QUALITY_TIERS[i].name, factor: QUALITY_TIERS[i].factor, raw: score };
        }
        return { key: '-1', name: '劣质', factor: 0.5, raw: score };
    }

    // 读取手持成品的品质：真源 = 料理乐事成品 NBT 的 CookedFoodData.score（游戏内"品质:%s%%"）
    function getQuality(item) {
        var nbt = null;
        try { if (item && typeof item.getNbt === 'function') nbt = item.getNbt(); } catch (e) {}
        if (!nbt && item && item.nbt) nbt = item.nbt;
        var score = undefined;
        if (nbt) {
            score = readScoreDirect(nbt);
            if (score === undefined) score = findScoreInTag(nbt);   // 直读失败才递归兜底
        }
        // 首次交付打印探针：真实 NBT 路径与数值，便于确认阈值是否需要微调
        if (!qualityProbeLogged) {
            qualityProbeLogged = true;
            try {
                var sub = (nbt && typeof nbt.getCompound === 'function') ? nbt.getCompound('CookedFoodData') : null;
                console.log('[交付][品质探针] CookedFoodData NBT = ' + (sub ? sub.toString() : '(无 CookedFoodData 复合标签)'));
            } catch (e) { console.log('[交付][品质探针] 读取 NBT 失败: ' + e); }
            console.log('[交付][品质探针] 解析得到 score = ' + score);
        }
        return scoreToTier(score);
    }

    // 读取手持物数量（核对"手上物品数量"）
    function getHeldCount(item) {
        try {
            if (typeof item.getCount === 'function') return item.getCount();
            if (typeof item.count === 'number') return item.count;
        } catch (e) {
        }
        return 1;   // 兜底为 1（多数情况下 max_stack_size=1）
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

        // 核对手上物品数量：必须真的拿着且数量 > 0
        let heldCount = getHeldCount(item);
        if (heldCount <= 0) {
            player.tell('顾客：你手里好像没有菜……');
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

        // 品质影响付款与反馈：真源 = 料理乐事成品 NBT 的 CookedFoodData.score
        let tier = getQuality(item);
        let factor = tier.factor;
        let qName = tier.name;
        let rawScore = tier.raw;
        let base = (typeof order.price === 'number') ? order.price : 0;
        let pay = Math.max(1, Math.round(base * factor));

        // 先记录数量再消耗，便于核对
        console.log('[交付] 校验通过：手持 ' + heldId + ' ×' + heldCount
            + '，订单价=$' + base + '，品质=' + qName
            + (rawScore !== null ? '（score=' + rawScore + '）' : '（score=未知，按普通占位）')
            + '，系数=' + factor + '，应付=$' + pay);

        // 消耗 1 个并标记已上菜
        consumeOne(item);
        try { target.persistentData.putBoolean('served', true); } catch (e) {}
        try { event.cancel(); } catch (e) {}      // 阻止物品被原交互逻辑二次消耗

        // ===== 3.7 补声望：按 2.4/2.5/2.6 结算星级与声望（付款仍走品质系数，选项 A）=====
        let star = 3;            // 计算失败兜底为中性 3 星
        let repDelta = 0;
        try {
            if (typeof global.computeStar === 'function') star = global.computeStar(target);
            let eff = (typeof global.getStarEffects === 'function') ? global.getStarEffects(star) : null;
            if (eff) {
                repDelta = eff.repDelta;
                if (typeof global.addReputation === 'function') global.addReputation(repDelta);
            }
            if (typeof global.recordRating === 'function') global.recordRating(star);
        } catch (e) {
            console.log('[交付] 声望结算失败: ' + e);
        }

        // ===== 2.8 小费：5 星时额外支付售价 10%，直接入账、不参与成本计算 =====
        let tip = 0;
        if (TIP_ENABLED && star === 5) {
            try {
                let rate = (typeof global.getStarEffects === 'function') ? global.getStarEffects(5).tipRate : 0.10;
                tip = Math.max(1, Math.round(base * rate));
            } catch (e) {
                console.log('[交付] 小费计算失败: ' + e);
            }
        }

        // ===== 接入货币系统：真正给玩家加钱（之前只聊天提示、从没调用 addBalance，故金额不变）=====
        let credited = false;
        try {
            if (typeof global.addBalance === 'function') {
                credited = global.addBalance(player, pay + tip);
                if (!credited) console.log('[交付] addBalance 返回 false（金额非正或玩家无效），未入账');
            } else {
                console.log('[交付] 警告：global.addBalance 未定义，金钱未入账（货币系统 currency_api.js 未加载？）');
            }
        } catch (e) {
            console.log('[交付] addBalance 调用失败: ' + e);
        }

        // 反馈与离场
        let qualityNote = qName + (rawScore !== null ? ' 品质' + rawScore + '%' : '');
        let balanceTxt = '';
        try { if (typeof global.getBalance === 'function') balanceTxt = '（当前余额 $' + global.getBalance(player) + '）'; } catch (e) {}
        let total = pay + tip;
        let starTxt = (typeof global.getStarEffects === 'function') ? global.getStarEffects(star).label : ('★'.repeat(star));
        let repTxt = (repDelta >= 0 ? ' 声望+' : ' 声望') + repDelta;
        player.tell('顾客：（' + qualityNote + '）这就对啦！付你 $' + total + balanceTxt + ' 评价：' + starTxt + repTxt);
        if (tip > 0) {
            player.tell('顾客很满意，额外给了 $' + tip + ' 小费！');
        }
        console.log('[交付] 顾客已离场，收到 ' + heldId + ' 品质=' + qName + ' score=' + rawScore
            + ' 付款=$' + total + '（含小费 $' + tip + '）' + (credited ? ' 已入账' : ' 未入账')
            + ' 星级=' + star + ' 声望' + (repDelta >= 0 ? '+' : '') + repDelta);

        // 顾客满意离场
        try { target.discard(); } catch (e) {
            console.log('[交付] 顾客离场失败: ' + e);
        }
    });

    console.log('[交付] 菜品交付逻辑已加载');
})();
