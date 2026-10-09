// ==================== 店铺等级凭证处理器（z1.3 章节门禁）====================
// 「店铺等级」章节里有 4 个 custom 任务（tag 形如 cc_lvl_gate_<声望阈值>）：
//   cc_lvl_gate_20  / 50 / 100 / 200，分别对应解锁 二/三/四/五星 食材章节。
// 这些任务随玩家声望（reputation_api.getReputation，原始声望点数）自动检测：
//   达到阈值即自动完成（setCheckTimer 周期轮询，无需玩家点击），从而解锁对应高级章节
//   （高级章节的购买任务已设 dependencies + hide_until_deps_complete，依赖此凭证）。
// 依赖：reputation_api.js（global.getReputation 返回原始声望点数，阈值 0/20/50/100/200）。

// 任务 tag -> 所需声望阈值
const GATE_TAGS = {
    "cc_lvl_gate_20": 20,
    "cc_lvl_gate_50": 50,
    "cc_lvl_gate_100": 100,
    "cc_lvl_gate_200": 200
};

FTBQuestsEvents.customTask(event => {
    let task = event.getTask();
    if (!task) return;

    // 从任务 tags 中找到 cc_lvl_gate_* 那个（getId() 返回 long，故用 tag 匹配）
    let entry = null;
    try {
        let tags = task.getTags();
        if (tags) {
            let arr = tags.toArray();
            for (let i = 0; i < arr.length; i++) {
                let tg = String(arr[i]);
                if (GATE_TAGS[tg] !== undefined) { entry = GATE_TAGS[tg]; break; }
            }
        }
    } catch (e) {
        console.log('[店铺等级] 读取任务 tag 出错: ' + e);
    }
    if (entry === null) return;                 // 非等级凭证任务，跳过

    event.setCheckTimer(20);                    // 每 20 tick(1s) 自动轮询一次
    event.setMaxProgress(1);                    // 完成所需进度=1

    event.setCheck((a, b) => {
        // 双保险：能力探测定位 player / data
        let player = (a && typeof a.give === 'function') ? a
                   : (b && typeof b.give === 'function') ? b : null;
        let data   = (a && typeof a.setProgress === 'function') ? a
                   : (b && typeof b.setProgress === 'function') ? b : null;
        if (!data) return false;

        try {
            let rep = (typeof global.getReputation === 'function') ? global.getReputation() : 0;
            if (rep >= entry) {
                data.setProgress(1);            // 声望达标 -> 自动完成（解锁对应高级章节）
                return true;
            }
            return false;                        // 未达标 -> 不完成，章节保持隐藏
        } catch (e) {
            console.log('[店铺等级] 检测声望出错: ' + e);
            return false;
        }
    });
});

console.log('[店铺等级] 凭证处理器已加载，共 ' + Object.keys(GATE_TAGS).length + ' 个等级凭证');
