// ==================== 顾客生成 ====================
// 营业期间在固定坐标生成顾客，并维护座位占用状态。
// 读取时段只能通过 global.getPhaseInfo()，不要直接读 global 的键（会触发不可捕获的 NPE）。

(function() {
    'use strict';

    let CUSTOMER_ID = 'cubicalcanteen:customer';
    let SPAWN_POINTS = [
        [12, -60, 0],
        [12, -60, -1],
        [12, -60, -2],
        [12, -60, -3],
        [12, -60, -4]
    ];
    let SPAWN_INTERVAL_TICKS = 600;   // 30 秒一位
    let WAIT_TICKS = 6000;            // 顾客最长等待 5 分钟（游戏刻，1 刻=0.05s），超时自动离场
    let ENABLE_AI = false;            // 顾客 AI：需实体基类为 entityjs:pathfinder 才生效，暂关

    let tickCounter = 0;
    let loggedQueryFallback = false;

    // ==================== 工具函数 ====================
    // Java 集合没有 .length，必须先转成数组
    function toJsArray(x) {
        if (!x) return [];
        try {
            if (typeof x.toArray === 'function') return x.toArray();
        } catch (e) {
        }
        try {
            return Array.from(x);
        } catch (e) {
            return [];
        }
    }

    function runCommand(server, cmd) {
        try {
            if (typeof server.runCommandSilent === 'function') {
                let r = server.runCommandSilent(cmd);
                return r === undefined ? true : !!r;
            }
            let r2 = server.runCommand(cmd);
            return r2 === undefined ? true : !!r2;
        } catch (e) {
            console.log('[顾客生成] 命令执行失败: ' + cmd + ' | ' + e);
            return false;
        }
    }

    function getPhaseInfo() {
        try {
            if (typeof global.getPhaseInfo === 'function') {
                return global.getPhaseInfo();
            }
        } catch (e) {
            console.log('[顾客生成] getPhaseInfo 调用异常: ' + e);
        }
        return null;
    }

    // ==================== 座位占用检测 ====================
    // 用 AABB 局部查询，返回座位范围内的存活实体数；-1 表示查询失败
    function countOccupants(level, x, y, z) {
        try {
            let box = AABB.of(x, y - 0.5, z, x + 1, y + 1.9, z + 1);
            let arr = toJsArray(level.getEntitiesWithin(box));
            let n = 0;
            for (let i = 0; i < arr.length; i++) {
                let e = arr[i];
                if (e && typeof e.isAlive === 'function' && e.isAlive()) n++;
            }
            return n;
        } catch (e) {
            if (!loggedQueryFallback) {
                loggedQueryFallback = true;
                console.log('[顾客生成] AABB 查询不可用，回退到全量实体列表: ' + e);
            }
        }

        // 回退：遍历实体列表，按坐标过滤
        try {
            let arr = toJsArray(level.getEntities());
            let n = 0;
            for (let i = 0; i < arr.length; i++) {
                let e = arr[i];
                if (!e || typeof e.isAlive !== 'function' || !e.isAlive()) continue;
                let dx = e.getX() - (x + 0.5);
                let dy = e.getY() - y;
                let dz = e.getZ() - (z + 0.5);
                if (Math.abs(dx) < 1.2 && Math.abs(dz) < 1.2 && dy > -1.5 && dy < 2.5) n++;
            }
            return n;
        } catch (e) {
            console.log('[顾客生成] 实体列表回退查询也失败: ' + e);
            return -1;
        }
    }

    function findFreeSeat(level) {
        for (let i = 0; i < SPAWN_POINTS.length; i++) {
            let p = SPAWN_POINTS[i];
            if (countOccupants(level, p[0], p[1], p[2]) <= 0) return p;
        }
        return null;
    }

    // ==================== 头顶订单显隐（任务 3.3）====================
    // 玩家 8 格内显示头顶订单，远离后隐藏。顾客最多 5 个，每 tick 扫描开销可忽略。
    const LABEL_RANGE = 8;

    // 距离判断：优先用实体内置 distanceToEntity，失败退化为坐标平方差
    function withinRange(e, p) {
        try {
            return e.distanceToEntity(p) <= LABEL_RANGE;
        } catch (err) {
            try {
                let dx = e.getX() - p.getX();
                let dy = e.getY() - p.getY();
                let dz = e.getZ() - p.getZ();
                return (dx * dx + dy * dy + dz * dz) <= LABEL_RANGE * LABEL_RANGE;
            } catch (err2) {
                return false;
            }
        }
    }

    function updateCustomerLabels(level) {
        try {
            let players = [];
            try {
                let s = Utils.server;
                if (s && typeof s.getPlayers === 'function') players = toJsArray(s.getPlayers());
            } catch (err) {
            }
            if (players.length === 0) return;

            let box = AABB.of(6, -62, -7, 16, -56, 3);
            let arr = toJsArray(level.getEntitiesWithin(box));
            for (let i = 0; i < arr.length; i++) {
                let e = arr[i];
                if (!e) continue;
                let isCustomer = false;
                try {
                    isCustomer = e.persistentData && e.persistentData.contains('cc_customer');
                } catch (err) {
                }
                if (!isCustomer) continue;
                let near = false;
                for (let j = 0; j < players.length; j++) {
                    if (withinRange(e, players[j])) { near = true; break; }
                }
                try {
                    e.setCustomNameVisible(near);
                } catch (err) {
                }
            }
        } catch (e) {
            console.log('[顾客生成] 更新订单显隐失败: ' + e);
        }
    }

    // ==================== 顾客离场（打烊清场 + 超时，任务 3.9 简化版）====================
    // 打烊 / 休店时清走所有顾客；营业中但等待超过 WAIT_TICKS 也自动离场。
    function checkCustomerLeave(level, server, info) {
        try {
            let box = AABB.of(6, -62, -7, 16, -56, 3);
            let arr = toJsArray(level.getEntitiesWithin(box));
            let now = server.getTickCount();
            let closed = !!(info && (info.isRestDay === true || info.phase !== '营业中'));
            for (let i = 0; i < arr.length; i++) {
                let e = arr[i];
                if (!e) continue;
                let isCustomer = false;
                try {
                    isCustomer = e.persistentData && e.persistentData.contains('cc_customer');
                } catch (err) {
                }
                if (!isCustomer) continue;
                let reason = null;   // 'closed' 打烊/休店清场，'timeout' 等太久
                if (closed) {
                    reason = 'closed';
                } else {
                    try {
                        let born = e.persistentData.getInt('spawn_tick');
                        if (now - born > WAIT_TICKS) reason = 'timeout';
                    } catch (err) {
                    }
                }
                if (reason) {
                    if (reason === 'timeout') {
                        // 3.8 补声望：超时离场扣声望（按 2.4 的 1★ 标准 -2），只扣超时、不打烊清场
                        try {
                            let delta = -2;
                            if (typeof global.getStarEffects === 'function') delta = global.getStarEffects(1).repDelta;
                            if (typeof global.addReputation === 'function') global.addReputation(delta);
                            if (typeof global.recordRating === 'function') global.recordRating(1);
                        } catch (err) {
                            console.log('[顾客生成] 超时扣声望失败: ' + err);
                        }
                        try { runCommand(server, 'say [餐厅] 顾客等太久离开了，店铺声望 -2'); } catch (err) {}
                    }
                    e.discard();
                }
            }
        } catch (e) {
            console.log('[顾客生成] 顾客离场检查失败: ' + e);
        }
    }

    // ==================== AI ====================
    // 只有基类是 entityjs:pathfinder 时才有 goalSelector，否则直接跳过
    function applyAi(entity) {
        if (!ENABLE_AI) return;
        try {
            let selector = entity.goalSelector;
            if (!selector) return;
            let Player = Java.loadClass('net.minecraft.world.entity.player.Player');
            let LookAtPlayerGoal = Java.loadClass('net.minecraft.world.entity.ai.goal.LookAtPlayerGoal');
            let RandomLookAroundGoal = Java.loadClass('net.minecraft.world.entity.ai.goal.RandomLookAroundGoal');
            selector.addGoal(6, new LookAtPlayerGoal(entity, Player, 8.0));
            selector.addGoal(7, new RandomLookAroundGoal(entity));
        } catch (e) {
            console.log('[顾客生成] 添加 AI 目标失败（不影响生成）: ' + e);
        }
    }

    // ==================== 生成顾客 ====================
    // 订单由 order_api.js 生成并写入顾客 NBT（任务 3.4）
    function setOrder(entity) {
        try {
            if (typeof global.assignOrder !== 'function') return null;
            let order = global.assignOrder(entity);
            if (order) {
                console.log('[顾客生成] 订单: ' + order.main + (order.drink ? ' + ' + order.drink : '') + '  $' + order.price);
            }
            return order;
        } catch (e) {
            console.log('[顾客生成] 生成订单失败: ' + e);
            return null;
        }
    }

    // 头顶只显示菜名：不再拼接"顾客"前缀（用户要求只要菜名，不要别的）
    function setDisplayName(entity) {
        let text = '顾客';   // 兜底名，正常会被订单菜名覆盖
        try {
            if (typeof global.getOrderDisplayText === 'function') {
                let order = global.getOrderDisplayText(entity);
                if (order) text = order;
            }
        } catch (e) {
            console.log('[顾客生成] 读取订单文本失败: ' + e);
        }
        try {
            let Component = Java.loadClass('net.minecraft.network.chat.Component');
            entity.setCustomName(Component.literal(text));
            return true;
        } catch (e) {
        }
        try {
            entity.customName = text;
            return true;
        } catch (e) {
            console.log('[顾客生成] 设置名称失败（不影响生成）: ' + e);
            return false;
        }
    }

    // 打上顾客标记，customer_protect.js 靠它拦截玩家伤害
    function markAsCustomer(entity) {
        try {
            entity.persistentData.putBoolean('cc_customer', true);
        } catch (e) {
            console.log('[顾客生成] 写入顾客标记失败: ' + e);
        }
    }

    function spawnByApi(server, level, x, y, z) {
        try {
            let entity = level.createEntity(CUSTOMER_ID);
            if (!entity) {
                console.log('[顾客生成] createEntity 返回空，改用命令生成');
                return false;
            }
            entity.setPosition(x + 0.5, y, z + 0.5);
            markAsCustomer(entity);
            try { entity.persistentData.putInt('spawn_tick', server.getTickCount()); } catch (e) {} // 记录生成时刻，用于超时离场
            setOrder(entity);                 // 先把订单写入 NBT
            setDisplayName(entity);             // 头顶只显示菜名
            level.addFreshEntity(entity);
            applyAi(entity);
            console.log('[顾客生成] 生成成功 @ (' + (x + 0.5) + ', ' + y + ', ' + (z + 0.5) + ')');
            return true;
        } catch (e) {
            console.log('[顾客生成] API 生成失败: ' + e);
            return false;
        }
    }

    function spawnBySummon(server, x, y, z) {
        let cmd = 'summon ' + CUSTOMER_ID + ' ' + (x + 0.5) + ' ' + y + ' ' + (z + 0.5) +
            ' {CustomName:\'{"text":"顾客"}\',CustomNameVisible:1b}';
        let ok = runCommand(server, cmd);
        console.log('[顾客生成] summon 回退 @ (' + (x + 0.5) + ', ' + y + ', ' + (z + 0.5) + ') -> ' + ok);
        return ok;
    }

    // ==================== 清理接口 ====================
    // /kill 对 isImmobile 实体无效，用 discard() 直接删除
    global.clearCustomers = function () {
        let removed = 0;
        try {
            let server = Utils.server;
            if (!server) return 0;
            let level = server.overworld();
            if (!level) return 0;
            let box = AABB.of(8, -62, -6, 15, -57, 2);
            let arr = toJsArray(level.getEntitiesWithin(box));
            for (let i = 0; i < arr.length; i++) {
                let e = arr[i];
                if (!e || typeof e.isAlive !== 'function' || !e.isAlive()) continue;
                let isCustomer = false;
                try {
                    isCustomer = e.persistentData && e.persistentData.contains('cc_customer');
                } catch (err) {
                }
                if (!isCustomer) continue;
                e.discard();
                removed++;
            }
        } catch (e) {
            console.log('[顾客生成] clearCustomers 异常: ' + e);
        }
        console.log('[顾客生成] 已清除顾客 ' + removed + ' 位');
        return removed;
    };

    // ==================== 主循环 ====================
    ServerEvents.tick(function(event) {
        try {
            let server = event.server;
            if (!server) return;
            let level = server.overworld();
            if (!level) return;

            let info = getPhaseInfo();

            // 每 tick 维护：头顶订单显隐（3.3）+ 离场检查（打烊清场 / 超时，3.9 简化）
            updateCustomerLabels(level);
            checkCustomerLeave(level, server, info);

            if (!info) { tickCounter = 0; return; }
            if (info.isRestDay === true) {           // 法定休店日 或 店主自选休店日
                tickCounter = 0;
                return;
            }
            if (info.phase !== '营业中') {
                tickCounter = 0;
                return;
            }

            tickCounter++;
            if (tickCounter < SPAWN_INTERVAL_TICKS) return;
            tickCounter = 0;

            let seat = findFreeSeat(level);
            if (!seat) {
                console.log('[顾客生成] 暂无空闲座位（上限 ' + SPAWN_POINTS.length + '）');
                return;
            }

            let ok = spawnByApi(server, level, seat[0], seat[1], seat[2]);
            if (!ok) {
                ok = spawnBySummon(server, seat[0], seat[1], seat[2]);
            }
            if (ok) {
                runCommand(server, 'say [餐厅] 一位顾客已入座！');
            }
        } catch (e) {
            console.log('[顾客生成] tick 异常: ' + e);
            if (e && e.stack) console.log(e.stack);
        }
    });

    console.log('[顾客生成] 加载完成，座位 ' + SPAWN_POINTS.length + ' 个');
})();
