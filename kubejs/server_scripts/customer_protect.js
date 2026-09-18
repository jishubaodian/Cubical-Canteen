// ==================== 顾客保护：禁止玩家误击顾客 ====================
// 用生成时写入的标记判断身份，不依赖 .type 字符串 ——
// 不同 KubeJS 版本返回格式不一致（有的带 entity. 前缀），靠字符串比容易静默失效。

(function() {
    'use strict';

    function isCustomer(entity) {
        // 主判断：生成时写入的标记
        try {
            if (entity.persistentData && entity.persistentData.contains('cc_customer')) {
                return true;
            }
        } catch (e) {
        }

        // 兜底：实体类型字符串，两种前缀都认
        try {
            let t = '' + entity.type;
            if (t === 'cubicalcanteen:customer' || t === 'entity.cubicalcanteen.customer') {
                return true;
            }
        } catch (e) {
        }
        return false;
    }

    EntityEvents.hurt(function(event) {
        let entity = event.entity;
        if (!isCustomer(entity)) return;

        // 正向判断"攻击者是不是玩家"：/kill 的攻击者是 null，不能靠"攻击者为空"反推
        let attacker = event.source.actual;
        if (attacker && attacker.isPlayer()) {
            event.cancel();
        }
    });
})();
