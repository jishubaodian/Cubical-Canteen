// ==================== 满意度与评分（任务 2.4 + 2.5）====================
// 2.4：五星等级与对应结算效果（声望增减 / 小费率）。
// 2.5：评分维度权重 + 分数→星级映射，提供 computeStar() 计算顾客星级。
// 付款仍由料理乐事品质系数决定（见 dish_delivery.js），星级在此只驱动声望与小费（选项 A）。

(function () {
    'use strict';

    // ==================== 2.4 星级效果表 ====================
    // 键为星级(1~5)。repDelta 为声望增减；tipRate 为小费率（5★=10%，发钱属 2.8，此处仅预留）。
    // payMult 为 2.4 原表的付款系数，V1 按选项 A 暂不用于付款（避免改掉已测的品质系数付款）。
    const STAR_EFFECTS = {
        5: { repDelta:  2, tipRate: 0.10, label: '★★★★★', payMult: 1.0 },
        4: { repDelta:  1, tipRate: 0.00, label: '★★★★',  payMult: 1.0 },
        3: { repDelta:  0, tipRate: 0.00, label: '★★★',   payMult: 1.0 },
        2: { repDelta: -1, tipRate: 0.00, label: '★★',    payMult: 1.0 },
        1: { repDelta: -2, tipRate: 0.00, label: '★',     payMult: 0.5 }
    };

    // 取某星级的结算效果；星级越界时夹到 1~5
    function getStarEffects(star) {
        let s = Math.max(1, Math.min(5, Math.floor(star)));
        return STAR_EFFECTS[s];
    }

    // ==================== 2.5 评分维度与映射 ====================
    // 三维度：上菜速度 40% / 菜品正确性 40% / 口味搭配 20%（V1 口味固定满分，等偏好系统再激活）。
    const SPEED_FULL_TICKS = 2000;   // ≤ 约 1.7 分钟：速度满分
    const SPEED_ZERO_TICKS = 6000;   // ≥ 5 分钟（与顾客生成 WAIT_TICKS 对齐）：速度 0 分
    const SCORE_TO_STAR = [
        { min: 90, star: 5 },
        { min: 75, star: 4 },
        { min: 60, star: 3 },
        { min: 40, star: 2 },
        { min: 0,  star: 1 }
    ];

    function scoreToStar(score) {
        if (isNaN(score)) score = 0;
        for (let i = 0; i < SCORE_TO_STAR.length; i++) {
            if (score >= SCORE_TO_STAR[i].min) return SCORE_TO_STAR[i].star;
        }
        return 1;
    }

    // 计算顾客星级：成功交付时调用。速度 = 1 - 已等待/上限；正确性 40 分（能到这就算对）；
    // 口味 20 分（V1 固定）。需要顾客 NBT 的 spawn_tick（生成时刻，customer_spawner 已写入）。
    function computeStar(entity) {
        let elapsed = SPEED_ZERO_TICKS;   // 取不到时间就按最慢算，避免虚高星级
        try {
            if (entity && entity.persistentData && entity.persistentData.contains('spawn_tick')) {
                let born = entity.persistentData.getInt('spawn_tick');
                let now = -1;
                try {
                    if (typeof Utils !== 'undefined' && Utils.server) now = Utils.server.getTickCount();
                } catch (e) {}
                if (now >= 0 && born >= 0) elapsed = Math.max(0, now - born);
            }
        } catch (e) {}
        let speedScore = Math.max(0, Math.min(100, 100 * (1 - elapsed / SPEED_ZERO_TICKS)));
        let total = 40 /* 正确性 */ + 20 /* 口味V1固定 */ + 0.4 * speedScore;
        return scoreToStar(total);
    }

    global.getStarEffects = getStarEffects;
    global.computeStar = computeStar;
    global.scoreToStar = scoreToStar;

    console.log('[满意度API] 加载完成');
})();
