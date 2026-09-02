<script setup lang="ts">
import { useGameStore } from '@/stores/game'

const game = useGameStore()
</script>

<template>
  <div class="rules">
    <header>
      <button class="btn ghost" @click="game.goto('home')">← 返回</button>
      <h1 class="title-font">规则速成</h1>
    </header>
    <div class="body">
      <section>
        <h2>🎪 目标</h2>
        <p>你是马戏团团长。用<strong>相邻的手牌</strong>排出比别人更豪华的节目（牌型），收买人心、挖走明星，总分最高者获胜。局数 = 玩家人数。</p>
      </section>
      <section>
        <h2>🃏 手牌的铁律</h2>
        <p>每张牌上下两端各印一个数字。发牌后顺序<strong>永久锁定</strong>，不能重排、不能抽出——只有两个例外：开局可以<strong>整手旋转 180°</strong>（一次）；挖角拿来的牌可以<strong>插进任意位置、任意朝向</strong>。</p>
      </section>
      <section>
        <h2>🎭 演出（Show）</h2>
        <p>从手牌里选<strong>连续的一段</strong>打出，必须是：</p>
        <ul>
          <li><strong>同数</strong>：如 9·9·9</li>
          <li><strong>顺子</strong>：连续数字，升序或降序都行，如 3·4·5 或 7·6·5</li>
          <li><strong>单张</strong>：任意一张（只能开局或桌面清空时凑数）</li>
        </ul>
        <p><strong>压过上一场演出</strong>的规则，按顺序比：</p>
        <ol>
          <li>张数多者强（3 张压 2 张）</li>
          <li>张数相同：<strong>同数 ＞ 顺子</strong></li>
          <li>张数与类型都相同：比<strong>最低数字</strong>，必须更大（相同不行）</li>
        </ol>
        <p>压过后，<strong>上一场演出的牌整叠收走</strong>，结算时每张 +1 分。</p>
      </section>
      <section>
        <h2>🔍 挖角（Scout）</h2>
        <p>压不过（或不想压）时，从当前牌型的<strong>左端或右端拿走 1 张</strong>，按任意朝向插进手牌任意缝隙。牌的主人获得 1 枚<strong>金币</strong>（结算 +1 分），演出继续留在桌上。</p>
      </section>
      <section>
        <h2>🎩 双动（Scout &amp; Show）</h2>
        <p>每轮一次：挖角之后<strong>立刻</strong>演出一块牌（必须压过被拿走一张后的剩余牌型）。</p>
      </section>
      <section>
        <h2>🏁 轮结束与计分</h2>
        <p>两种结束方式：</p>
        <ul>
          <li>有人<strong>打光手牌</strong>，立即结束</li>
          <li>一圈人都<strong>只挖角不演出</strong>、演出回到主人面前，立即结束（主人免剩牌罚分）</li>
        </ul>
        <p>计分 = <strong>收来的暗牌 ×1 + 金币 ×1 − 剩余手牌 ×1</strong>。下一轮首出者向左轮换，重发全牌。</p>
      </section>
      <section>
        <h2>📦 牌组</h2>
        <p>45 张 = 1~10 两两组成的所有数字对（每张唯一）。3 人局去掉所有含 10 的牌（每人 12 张）；4 人局去掉 9/10 一张（每人 11 张）；5 人局全用（每人 9 张）。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.rules {
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px 40px;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
header .btn {
  padding: 8px 16px;
  font-size: 13px;
}
h1 {
  font-size: 22px;
  color: var(--gold);
}
.body {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
section {
  background: rgba(10, 30, 22, 0.6);
  border-radius: var(--radius-panel);
  padding: 14px 16px;
  box-shadow: inset 0 0 0 1px rgba(247, 239, 221, 0.12);
}
h2 {
  font-size: 15px;
  color: var(--gold);
  margin-bottom: 8px;
}
p,
li {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--cream);
}
ul,
ol {
  padding-left: 20px;
  margin: 6px 0;
}
strong {
  color: var(--gold);
}
</style>
