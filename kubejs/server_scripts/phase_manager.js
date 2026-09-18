// ==================== 餐厅时段引擎 ====================
// 时段系统的唯一数据源：四时段检测、天数、休店日、预告、动作栏、登录欢迎。
// 休店日选择与播报标记写入世界数据，重启不丢。
//
// 注意：不要向 global 写入 null —— 读取"值为 null"的键会触发不可捕获的 NPE，
// 详情见 数据\错误分析\NPE根因分析报告.md
//
// 对外接口（其它脚本只准用这些）：
//   global.getPhaseInfo()          -> { phase, day, moment, isRestDay, isForcedRestDay, isSelectedRestDay }
//   global.getSelectedRestDay()    -> 数字，未设置时为 -1
//   global.setSelectedRestDay(day)
//   global.clearSelectedRestDay()

(function () {
    'use strict';

    console.log('[时段管理] 加载中...');

    // ==================== 常量 ====================
    let REST_DAY_PERIOD = 5;      // 每 5 天一个法定休店日
    let DAY_LENGTH = 24000;       // 一个游戏日的 tick 数

    let PHASE = {
        PREPARATION: '备餐期',
        BUSINESS: '营业中',
        CLOSING: '收尾期',
        REST: '歇业期'
    };

    let PHASE_TIPS = {
        '备餐期': '🕔 备餐期：厨师准备食材，即将开门迎客！',
        '营业中': '☀️ 营业中：欢迎光临！食客们正在路上。',
        '收尾期': '🌆 收尾期：即将关门，请尽快下单！',
        '歇业期': '🌙 歇业期：餐厅已打烊，明日再会！'
    };

    // 持久化键名
    let KEY_SELECTED_REST = 'cc_selectedRestDay';
    let KEY_NOTIFIED_REST = 'cc_notifiedRestDay';
    let KEY_WARN_NEXT_FORCED = 'cc_warnNextForced';
    let KEY_WARN_NEXT_SELECTED = 'cc_warnNextSelected';
    let KEY_FORCED_NOTIFIED = 'cc_forcedNotified';

    // 内存缓存键名 -> 持久化键名
    let KEY_MAP = {
        selectedRestDay: KEY_SELECTED_REST,
        notifiedRestDay: KEY_NOTIFIED_REST,
        warnNextForced: KEY_WARN_NEXT_FORCED,
        warnNextSelected: KEY_WARN_NEXT_SELECTED,
        forcedNotified: KEY_FORCED_NOTIFIED
    };

    // ==================== 运行时状态（闭包内，不直接暴露到 global） ====================
    let state = {
        phase: '未知',
        day: 1,
        moment: 0,
        isForcedRestDay: false,
        isSelectedRestDay: false,
        isRestDay: false
    };

    let lastPhase = null;
    let bootDone = false;

    // 持久化
    let store = null;             // CompoundTag 或 null
    let storeReady = false;
    let storeWarned = false;
    let mem = {
        selectedRestDay: -1,
        notifiedRestDay: -1,
        warnNextForced: -1,
        warnNextSelected: -1,
        forcedNotified: -1
    };

    // ==================== 工具函数 ====================
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

    function runSilent(server, cmd) {
        try {
            if (typeof server.runCommandSilent === 'function') {
                server.runCommandSilent(cmd);
                return;
            }
            server.runCommand(cmd);
        } catch (e) {
            console.log('[时段管理] 命令执行失败: ' + cmd + ' | ' + e);
        }
    }

    function playerName(player) {
        try {
            let n = player.getName().getString();
            if (n) return n;
        } catch (e) {
        }
        try {
            return '' + player.getScoreboardName();
        } catch (e) {
            return '';
        }
    }

    function balanceText(player) {
        let v = 0;
        try {
            if (typeof global.getBalance === 'function') {
                v = global.getBalance(player);
            }
        } catch (e) {
            v = 0;
        }
        try {
            if (typeof global.formatCurrency === 'function') {
                return global.formatCurrency(v);
            }
        } catch (e) {
        }
        return '$' + v;
    }

    // ==================== 持久化层 ====================
    // 优先写入世界持久化数据（level / server 的 persistentData），
    // 失败时退化为内存缓存并在控制台提示一次：功能仍可用，但重启后选择会丢。
    function initStore(level, server) {
        if (storeReady) return;
        storeReady = true;

        // 依次尝试 4 种取值方式：属性式 / 方法式 × 世界 / 服务端
        let tag = null;
        let attempts = [];
        try {
            tag = level ? level.persistentData : null;
        } catch (e) {
            attempts.push('level.persistentData: ' + e);
        }
        if (!tag) {
            try {
                tag = level ? level.getPersistentData() : null;
            } catch (e) {
                attempts.push('level.getPersistentData(): ' + e);
            }
        }
        if (!tag) {
            try {
                tag = server ? server.persistentData : null;
            } catch (e) {
                attempts.push('server.persistentData: ' + e);
            }
        }
        if (!tag) {
            try {
                tag = server ? server.getPersistentData() : null;
            } catch (e) {
                attempts.push('server.getPersistentData(): ' + e);
            }
        }

        if (tag) {
            store = tag;
        } else if (!storeWarned) {
            storeWarned = true;
            console.log('[时段管理] 未能获取世界持久化数据，休店日选择将在重启后丢失' +
                (attempts.length ? '（' + attempts.join(' | ') + '）' : ''));
        }
    }

    function getFlag(name, fallback) {
        if (!store) return mem[name];
        try {
            if (!store.contains(KEY_MAP[name])) return fallback;
            return store.getInt(KEY_MAP[name]);
        } catch (e) {
            return mem[name];
        }
    }

    function setFlag(name, value) {
        mem[name] = value;
        if (!store) return;
        try {
            store.putInt(KEY_MAP[name], value);
        } catch (e) {
            console.log('[时段管理] 持久化写入失败 ' + name + ': ' + e);
        }
    }

    // ==================== 时段与天数 ====================
    function getPhase(moment) {
        if (moment >= 23000) return PHASE.PREPARATION;
        if (moment < 12000) return PHASE.BUSINESS;
        if (moment < 14000) return PHASE.CLOSING;
        return PHASE.REST;
    }

    // 从 Day 1 开始计数：dayTime 0 属于第 1 天
    function getDayCount(dayTime) {
        return Math.floor(dayTime / DAY_LENGTH) + 1;
    }

    // ==================== 对外接口 ====================
    // 统一出口：其它脚本只调用这些函数，返回值是普通 JS 对象 / 数字
    global.getPhaseInfo = function () {
        return {
            phase: state.phase,
            day: state.day,
            moment: state.moment,
            isRestDay: state.isRestDay,
            isForcedRestDay: state.isForcedRestDay,
            isSelectedRestDay: state.isSelectedRestDay
        };
    };

    global.getSelectedRestDay = function () {
        return getFlag('selectedRestDay', -1);
    };

    global.setSelectedRestDay = function (day) {
        setFlag('selectedRestDay', day);
        setFlag('notifiedRestDay', -1);
    };

    global.clearSelectedRestDay = function () {
        setFlag('selectedRestDay', -1);
    };

    // 兼容旧键：用非 null 值覆盖可能残留的污染值
    // 注意：这里只能"覆盖写入"，绝不能先读取（读到 null 会立刻崩）
    try {
        global.currentPhase = state.phase;
        global.isRestDay = state.isRestDay;
        global.currentDay = state.day;
    } catch (e) {
        console.log('[时段管理] 初始化 global 兼容键失败（可忽略）: ' + e);
    }

    // ==================== 主循环 ====================
    ServerEvents.tick(function (event) {
        try {
            let server = event.server;
            if (!server) return;

            let level = server.overworld();
            if (!level) return;

            initStore(level, server);

            // 首 tick 关闭命令反馈，避免 /title 刷屏
            if (!bootDone) {
                bootDone = true;
                runSilent(server, 'gamerule sendCommandFeedback false');
            }

            let tick = server.getTickCount();
            if (tick % 20 !== 0) return;   // 每秒执行一次

            let dayTime = level.getDayTime();
            let moment = dayTime % DAY_LENGTH;
            let dayCount = getDayCount(dayTime);
            let newPhase = getPhase(moment);

            let isForcedRestDay = (dayCount % REST_DAY_PERIOD === 0);
            let selectedDay = getFlag('selectedRestDay', -1);
            let isSelectedRestDay = (selectedDay === dayCount);
            let isRestDay = isForcedRestDay || isSelectedRestDay;

            // 更新运行时状态
            state.moment = moment;
            state.day = dayCount;
            state.isForcedRestDay = isForcedRestDay;
            state.isSelectedRestDay = isSelectedRestDay;
            state.isRestDay = isRestDay;

            // 阶段切换
            if (lastPhase === null) {
                lastPhase = newPhase;
                state.phase = newPhase;
                runSilent(server, 'say [餐厅] 当前时段: ' + newPhase);
            } else if (newPhase !== lastPhase) {
                let previousPhase = lastPhase;
                lastPhase = newPhase;
                state.phase = newPhase;
                runSilent(server, 'say [餐厅] 时段切换: ' + previousPhase + ' → ' + newPhase);
                if (PHASE_TIPS[newPhase]) {
                    runSilent(server, 'say [餐厅] ' + PHASE_TIPS[newPhase]);
                }
            } else {
                state.phase = newPhase;
            }

            // 同步兼容键（全部为非 null 值）
            global.currentPhase = state.phase;
            global.isRestDay = state.isRestDay;
            global.currentDay = state.day;

            // ---------- 店主自选休店日：当天播报（一次性） ----------
            if (isSelectedRestDay && getFlag('notifiedRestDay', -1) !== dayCount) {
                setFlag('notifiedRestDay', dayCount);
                runSilent(server, 'say [餐厅] 今日店主自选休店，餐厅暂不营业！');
            }

            // ---------- 法定休店日：当天播报（一次性） ----------
            if (isForcedRestDay && getFlag('forcedNotified', -1) !== dayCount) {
                setFlag('forcedNotified', dayCount);
                runSilent(server, 'say [休店] 今日（第' + dayCount + '天）为法定休店日，餐厅歇业一天！');
            }

            // ---------- 次日预告（20:00 之后） ----------
            if (moment >= 20000 && moment < DAY_LENGTH) {
                let nextDay = dayCount + 1;
                let nextIsForced = (nextDay % REST_DAY_PERIOD === 0);
                let nextIsSelected = (getFlag('selectedRestDay', -1) === nextDay);

                if (nextIsForced && getFlag('warnNextForced', -1) !== nextDay) {
                    setFlag('warnNextForced', nextDay);
                    runSilent(server, 'say [预告] 明日（第' + nextDay + '天）为法定休店日！');
                }
                if (nextIsSelected && getFlag('warnNextSelected', -1) !== nextDay) {
                    setFlag('warnNextSelected', nextDay);
                    runSilent(server, 'say [预告] 明日（第' + nextDay + '天）已安排店主休店日！');
                }
            }

            // ---------- 动作栏：余额 + 天数 + 时段 + 休店标签 ----------
            let restTag = '';
            if (isForcedRestDay) {
                restTag = ' §c[法定休店日]';
            } else if (isSelectedRestDay) {
                restTag = ' §e[店主休店日]';
            }

            let players = toJsArray(server.getPlayers());
            for (let i = 0; i < players.length; i++) {
                let player = players[i];
                if (!player) continue;
                let name = playerName(player);
                if (!name) continue;
                let msg = balanceText(player) + ' | §e天数: ' + dayCount + '  §a时段: ' + state.phase + restTag;
                runSilent(server, 'title ' + name + ' actionbar {"text":"' + msg + '"}');
            }
        } catch (e) {
            console.log('[时段管理] tick 异常: ' + e);
            if (e && e.stack) console.log(e.stack);
        }
    });

    // ==================== 玩家登录 ====================
    PlayerEvents.loggedIn(function (event) {
        try {
            let player = event.player;
            let server = player.getServer();
            if (!server) return;
            let level = server.overworld();
            if (!level) return;

            initStore(level, server);

            let dayTime = level.getDayTime();
            let dayCount = getDayCount(dayTime);
            let phase = getPhase(dayTime % DAY_LENGTH);
            let isForcedRestDay = (dayCount % REST_DAY_PERIOD === 0);
            let isSelectedRestDay = (getFlag('selectedRestDay', -1) === dayCount);

            let restMsg = '';
            if (isForcedRestDay) {
                restMsg = '（法定休店日）';
            } else if (isSelectedRestDay) {
                restMsg = '（店主休店日）';
            }

            let name = playerName(player);
            runSilent(server, 'tellraw ' + name +
                ' {"text":"当前天数: 第' + dayCount + '天   时段: ' + phase + restMsg + '","color":"green"}');

            if (getFlag('selectedRestDay', -1) === dayCount + 1) {
                runSilent(server, 'tellraw ' + name +
                    ' {"text":"提示：明日（第' + (dayCount + 1) + '天）已安排店主休店日。","color":"yellow"}');
            }
        } catch (e) {
            console.log('[时段管理] 登录处理异常: ' + e);
        }
    });

    console.log('[时段管理] 加载完成');
})();
