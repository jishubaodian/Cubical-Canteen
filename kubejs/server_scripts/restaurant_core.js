// ==================== 餐厅核心逻辑（超级调试版） ====================
// 每步都输出日志，方便精确定位问题

(function() {
    'use strict';

    console.log('[DEBUG] ====== 脚本开始执行 ======');

    // -------- 配置 ----------
    let SPAWN_POINTS = [
        [12, -60, -4],
        [12, -60, -3],
        [12, -60, -2],
        [12, -60, -1],
        [12, -60, 0]
    ];
    let SPAWN_INTERVAL_TICKS = 600; // 测试用 30 秒，便于快速验证

    console.log('[DEBUG] 生成点坐标列表:');
    for (let i = 0; i < SPAWN_POINTS.length; i++) {
        let p = SPAWN_POINTS[i];
        console.log('[DEBUG]   点 ' + i + ': (' + p[0] + ', ' + p[1] + ', ' + p[2] + ')');
    }
    console.log('[DEBUG] 生成间隔: ' + SPAWN_INTERVAL_TICKS + ' ticks (约 ' + (SPAWN_INTERVAL_TICKS/20) + ' 秒)');

    // -------- 时段函数 ----------
    function getPhase(moment) {
        if (moment >= 23000) return '备餐期';
        if (moment < 12000) return '营业中';
        if (moment < 14000) return '收尾期';
        return '歇业期';
    }

    // -------- 获取空闲生成点（含详细日志） ----------
    function getAvailableSpawnPoint(level) {
        console.log('[DEBUG] ==== 开始检查空闲生成点 ====');

        // 获取所有实体
        let entities = level.getEntities();
        let totalEntities = 0;
        try {
            totalEntities = entities.length;
        } catch (e) {
            console.log('[DEBUG] entities 无法获取 length，可能不是数组，尝试转换为数组');
            entities = Array.from(entities);
            totalEntities = entities.length;
        }
        console.log('[DEBUG] 世界中实体总数: ' + totalEntities);

        // 筛选顾客
        let customers = [];
        for (let i = 0; i < entities.length; i++) {
            let e = entities[i];
            let typeStr = e.type || '未知类型';
            if (typeStr === 'entity.cubicalcanteen.customer') {
                customers.push(e);
                console.log('[DEBUG]   找到顾客实体: ' + e.getName() + ', 类型: ' + typeStr);
            } else {
                // 可选：输出前几个非顾客实体类型以便检查
                if (i < 5) console.log('[DEBUG]   非顾客实体: ' + typeStr);
            }
        }
        console.log('[DEBUG] 共找到 ' + customers.length + ' 个顾客实体');

        // 构建占用集合
        let occupied = {};
        for (let i = 0; i < customers.length; i++) {
            let c = customers[i];
            let pos = c.blockPosition();
            let key = '' + pos.getX() + ',' + pos.getY() + ',' + pos.getZ();
            occupied[key] = true;
            console.log('[DEBUG]   顾客位于: ' + key + ' (坐标: ' + pos.getX() + ', ' + pos.getY() + ', ' + pos.getZ() + ')');
        }

        // 检查每个生成点是否被占用
        console.log('[DEBUG] 检查生成点占用情况:');
        for (let i = 0; i < SPAWN_POINTS.length; i++) {
            let p = SPAWN_POINTS[i];
            let key = '' + p[0] + ',' + p[1] + ',' + p[2];
            let isOccupied = occupied[key] === true;
            console.log('[DEBUG]   点 ' + i + ' (' + p[0] + ', ' + p[1] + ', ' + p[2] + ') -> ' + (isOccupied ? '已占用' : '空闲'));
            if (!isOccupied) {
                console.log('[DEBUG] 选择空闲点: ' + key);
                return p;
            }
        }

        console.log('[DEBUG] 所有生成点均已占用，无法生成新顾客');
        return null;
    }

    // -------- 生成顾客（使用 entity.spawn() 替代 addEntity） ----------
    function spawnCustomer(level, x, y, z) {
        console.log('[DEBUG] ==== 开始生成顾客 ====');
        console.log('[DEBUG] 目标坐标: (' + x + ', ' + y + ', ' + z + ')');
        console.log('[DEBUG] 实际生成位置: (' + (x+0.5) + ', ' + y + ', ' + (z+0.5) + ')');

        // 尝试创建实体
        console.log('[DEBUG] 调用 level.createEntity("cubicalcanteen:customer")');
        let entity = null;
        try {
            entity = level.createEntity('cubicalcanteen:customer');
        } catch (e) {
            console.log('[ERROR] createEntity 抛出异常: ' + e);
            if (e.stack) console.log(e.stack);
            return false;
        }

        if (!entity) {
            console.log('[ERROR] createEntity 返回 null，实体类型可能未注册或名称错误');
            console.log('[DEBUG] 请检查 customer_entity.js 中注册的实体 ID');
            return false;
        }
        console.log('[DEBUG] 实体对象创建成功，类型: ' + entity.type + ', ID: ' + entity.getId());

        // 设置位置
        try {
            entity.setPosition(x + 0.5, y, z + 0.5);
            console.log('[DEBUG] setPosition 调用成功');
        } catch (e) {
            console.log('[ERROR] setPosition 异常: ' + e);
            if (e.stack) console.log(e.stack);
            return false;
        }

        // ========== 关键修复：使用 entity.spawn() 替代 level.addEntity ==========
        try {
            // 使用 EntityJS 提供的 spawn 方法
            entity.spawn();
            console.log('[DEBUG] entity.spawn() 调用成功，实体已加入世界');
            console.log('[DEBUG] 顾客生成成功！');
            return true;
        } catch (e) {
            console.log('[ERROR] entity.spawn() 异常: ' + e);
            if (e.stack) console.log(e.stack);
            // 备用方案：尝试使用 addFreshEntity
            try {
                console.log('[DEBUG] 尝试备用方案: level.addFreshEntity(entity)');
                level.addFreshEntity(entity);
                console.log('[DEBUG] addFreshEntity 成功');
                return true;
            } catch (e2) {
                console.log('[ERROR] addFreshEntity 也失败: ' + e2);
                return false;
            }
        }
    }

    // -------- 状态变量 ----------
    let lastPhase = null;
    let restNotified = -1;
    let tickCounter = 0;
    let firstTick = true;

    // 暴露全局变量
    global.currentPhase = null;
    global.isRestDay = false;
    global.currentDay = 0;

    // -------- 核心 Tick 逻辑 ----------
    function onTick(server) {
        try {
            let tick = server.getTickCount();

            // 首次 tick 输出
            if (firstTick) {
                firstTick = false;
                console.log('[DEBUG] 首次 tick 触发, tick = ' + tick);
            }

            // 每 10 个 tick 输出一次状态（避免刷屏，但又能看到更新）
            if (tick % 10 === 0) {
                console.log('[DEBUG] tick=' + tick + ' (每10 ticks输出)');
            }

            let level = server.overworld();
            if (!level) {
                console.log('[ERROR] server.overworld() 返回 null，无法继续');
                return;
            }

            let dayTime = level.getDayTime();
            let moment = dayTime % 24000;
            let dayCount = Math.floor(dayTime / 24000);
            let phase = getPhase(moment);
            let isRestDay = (dayCount % 5 === 0);

            // 更新全局变量
            global.currentPhase = phase;
            global.isRestDay = isRestDay;
            global.currentDay = dayCount;

            // 每个 tick 输出当前状态（但每 20 tick 才输出一次，即每秒一次）
            if (tick % 20 === 0) {
                console.log('[DEBUG] 状态: 阶段=' + phase + ', 休店=' + isRestDay + ', 天数=' + dayCount + ', 计数器=' + tickCounter);
            }

            // 每秒执行一次动作（广播、动作栏）
            if (tick % 20 === 0) {
                // 时段切换
                if (lastPhase !== phase) {
                    let old = lastPhase;
                    lastPhase = phase;
                    let msg = old ? '时段切换: ' + old + ' → ' + phase : '当前时段: ' + phase;
                    server.runCommand('say [餐厅] ' + msg);
                    console.log('[DEBUG] 时段变化: ' + msg);
                }

                // 休店日提示
                if (isRestDay && restNotified !== dayCount) {
                    restNotified = dayCount;
                    server.runCommand('say [餐厅] 今日休店日，餐厅歇业！');
                    console.log('[DEBUG] 休店日提示已发送');
                }

                // 动作栏更新
                let players = server.getPlayers();
                console.log('[DEBUG] 在线玩家数: ' + players.length);
                for (let i = 0; i < players.length; i++) {
                    let player = players[i];
                    let balance = 0;
                    try {
                        if (typeof global.getBalance === 'function') {
                            balance = global.getBalance(player);
                        } else {
                            console.log('[DEBUG] global.getBalance 不是函数，使用默认余额 0');
                        }
                    } catch (e) {
                        console.log('[WARN] 获取余额时出错: ' + e);
                    }
                    let restTag = isRestDay ? ' §c[休店日]' : '';
                    let msg = '$' + balance + ' | §e天数: ' + dayCount + '  §a时段: ' + phase + restTag;
                    server.runCommand('title ' + player.getName().getString() + ' actionbar {"text":"' + msg + '"}');
                    if (i === 0) console.log('[DEBUG] 为玩家 ' + player.getName().getString() + ' 设置动作栏: ' + msg);
                }
            }

            // -------- 顾客生成逻辑（每个 tick 都执行） ----------
            // 条件检查：非休店日 且 营业中
            if (!isRestDay && phase === '营业中') {
                // 满足条件，计数器递增
                tickCounter++;
                if (tickCounter % 100 === 0) {
                    console.log('[DEBUG] 计数器当前值: ' + tickCounter);
                }
                if (tickCounter >= SPAWN_INTERVAL_TICKS) {
                    console.log('[DEBUG] ***** 达到生成间隔，开始生成 *****');
                    tickCounter = 0;
                    let point = getAvailableSpawnPoint(level);
                    if (point) {
                        let success = spawnCustomer(level, point[0], point[1], point[2]);
                        if (success) {
                            server.runCommand('say [餐厅] 一位顾客已入座！');
                            console.log('[DEBUG] 顾客生成成功并已广播');
                        } else {
                            console.log('[ERROR] 顾客生成失败，请检查上方日志');
                        }
                    } else {
                        console.log('[DEBUG] 没有空闲生成点，本次跳过');
                    }
                }
            } else {
                // 不满足条件，计数器归零
                if (tickCounter !== 0) {
                    console.log('[DEBUG] 条件不满足（休店=' + isRestDay + ', 阶段=' + phase + '），重置计数器（原值=' + tickCounter + '）');
                    tickCounter = 0;
                }
            }

        } catch (e) {
            console.log('[ERROR] onTick 发生未捕获异常: ' + e);
            if (e.stack) console.log(e.stack);
        }
    }

    // -------- 事件订阅 ----------
    ServerEvents.tick(function(event) {
        if (typeof global._coreStarted === 'undefined') {
            global._coreStarted = true;
            event.server.runCommand('gamerule sendCommandFeedback false');
            console.log('[DEBUG] 核心初始化完成');
        }
        onTick(event.server);
    });

    console.log('[DEBUG] ====== 脚本加载完成 ======');
})();