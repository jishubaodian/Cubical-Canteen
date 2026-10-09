// ==================== 店铺声望 API（任务 2.6，服务端 NBT 存储）====================
// 声望是全店共享值，存在 server.overworld().persistentData（存档重载不丢）。
// 不用玩家 persistentData（那是 per-player 货币），也不用 global（每次 /reload 重置）。

(function () {
    'use strict';

    const REP_KEY = 'cc_reputation';

    // 取主世界持久化 NBT（与 customer_spawner 的休店日持久化同源，最稳）
    function serverData() {
        try {
            let srv = Utils.server;
            if (srv && srv.overworld) {
                let lvl = srv.overworld();
                if (lvl && lvl.persistentData) return lvl.persistentData;
            }
        } catch (e) {
        }
        return null;
    }

    // ==================== 声望读写 ====================
    function getReputation() {
        try {
            let d = serverData();
            if (!d) return 0;
            if (!d.contains(REP_KEY)) d.putInt(REP_KEY, 0);
            return d.getInt(REP_KEY);
        } catch (e) {
            console.log('[声望] getReputation 错误: ' + e);
            return 0;
        }
    }

    // 增减声望：下限 0，不扣成负数；返回最新值
    function addReputation(amount) {
        try {
            let real = Math.floor(amount);
            if (isNaN(real) || real === 0) return getReputation();
            let cur = getReputation();
            let next = Math.max(0, cur + real);
            let d = serverData();
            if (d) d.putInt(REP_KEY, next);
            console.log('[声望] ' + (real >= 0 ? '+' : '') + real + '（当前 ' + next + '）');
            return next;
        } catch (e) {
            console.log('[声望] addReputation 错误: ' + e);
            return getReputation();
        }
    }

    // 声望 → 店铺星级（阈值取自 2.7 策划，V1 占位，数值后续调优）
    const SHOP_STAR_THRESHOLDS = [
        { stars: 1, rep: 0 },
        { stars: 2, rep: 20 },
        { stars: 3, rep: 50 },
        { stars: 4, rep: 100 },
        { stars: 5, rep: 200 }
    ];

    function getStars() {
        let rep = getReputation();
        let s = 1;
        for (let i = 0; i < SHOP_STAR_THRESHOLDS.length; i++) {
            if (rep >= SHOP_STAR_THRESHOLDS[i].rep) s = SHOP_STAR_THRESHOLDS[i].stars;
        }
        return s;
    }

    // ==================== 当日评分汇总（供 2.4 getTodayAverageRating）====================
    const RATING_DAY = 'cc_rating_day';
    const RATING_SUM = 'cc_rating_sum';
    const RATING_COUNT = 'cc_rating_count';

    function todayDay() {
        try {
            let srv = Utils.server;
            if (srv && srv.overworld) {
                let lvl = srv.overworld();
                if (lvl) return Math.floor(lvl.getDayTime() / 24000);
            }
        } catch (e) {
        }
        return -1;
    }

    // 记录一次评分（跨天自动重置当日累加器）
    function recordRating(star) {
        try {
            let d = serverData();
            if (!d) return;
            let day = todayDay();
            if (day < 0) return;
            let storedDay = d.contains(RATING_DAY) ? d.getInt(RATING_DAY) : -1;
            if (storedDay !== day) {
                d.putInt(RATING_DAY, day);
                d.putInt(RATING_SUM, 0);
                d.putInt(RATING_COUNT, 0);
            }
            d.putInt(RATING_SUM, d.getInt(RATING_SUM) + star);
            d.putInt(RATING_COUNT, d.getInt(RATING_COUNT) + 1);
        } catch (e) {
            console.log('[声望] recordRating 错误: ' + e);
        }
    }

    function getTodayAverageRating() {
        try {
            let d = serverData();
            if (!d) return 0;
            let day = todayDay();
            let storedDay = d.contains(RATING_DAY) ? d.getInt(RATING_DAY) : -1;
            if (storedDay !== day) return 0;   // 今天还没有评分
            let count = d.contains(RATING_COUNT) ? d.getInt(RATING_COUNT) : 0;
            if (count <= 0) return 0;
            return d.getInt(RATING_SUM) / count;
        } catch (e) {
            console.log('[声望] getTodayAverageRating 错误: ' + e);
            return 0;
        }
    }

    global.getReputation = getReputation;
    global.addReputation = addReputation;
    global.getStars = getStars;
    global.recordRating = recordRating;
    global.getTodayAverageRating = getTodayAverageRating;

    console.log('[声望API] 加载完成');
})();
