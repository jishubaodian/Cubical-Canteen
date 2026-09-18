// ==================== 顾客生成 ====================
// 营业期间在固定坐标生成顾客，并维护座位占用状态。
// 读取时段只能通过 global.getPhaseInfo()，不要直接读 global 的键（会触发不可捕获的 NPE）。

(function() {
    'use strict';

    let CUSTOMER_ID = 'cubicalcanteen:customer';
    let SPAWN_POINTS = [
        [12, -60, -4],
        [10, -60, -3],
        [10, -60, -2],
        [12, -60, -1],
        [12, -60, 0]
    ];
    let SPAWN_INTERVAL_TICKS = 600;   // 30 秒一位
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
    // 阶段 3 的订单在这里写入，例如 entity.persistentData.putString('order_dish', dishId)
    function setOrder(entity, dishId) {
    }

    function setDisplayName(entity, name) {
        try {
            let Component = Java.loadClass('net.minecraft.network.chat.Component');
            entity.setCustomName(Component.literal(name));
            entity.setCustomNameVisible(true);
            return true;
        } catch (e) {
        }
        try {
            entity.customName = name;
            entity.setCustomNameVisible(true);
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

    function spawnByApi(level, x, y, z) {
        try {
            let entity = level.createEntity(CUSTOMER_ID);
            if (!entity) {
                console.log('[顾客生成] createEntity 返回空，改用命令生成');
                return false;
            }
            entity.setPosition(x + 0.5, y, z + 0.5);
            markAsCustomer(entity);
            setDisplayName(entity, '顾客');
            setOrder(entity, null);
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
            let info = getPhaseInfo();
            if (!info) return;
            if (info.isRestDay === true) {           // 法定休店日 或 店主自选休店日
                tickCounter = 0;
                return;
            }
            if (info.phase !== '营业中') {
                tickCounter = 0;
                return;
            }

            let server = event.server;
            if (!server) return;
            let level = server.overworld();
            if (!level) return;

            tickCounter++;
            if (tickCounter < SPAWN_INTERVAL_TICKS) return;
            tickCounter = 0;

            let seat = findFreeSeat(level);
            if (!seat) {
                console.log('[顾客生成] 暂无空闲座位（上限 ' + SPAWN_POINTS.length + '）');
                return;
            }

            let ok = spawnByApi(level, seat[0], seat[1], seat[2]);
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
