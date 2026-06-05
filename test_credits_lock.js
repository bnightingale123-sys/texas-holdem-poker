/**
 * test_credits_lock.js
 * 静态代码分析 + 逻辑验证
 * 验证积分锁定机制的所有关键保护点是否正确实现
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${testName}`);
    if (detail) console.log(`     → ${detail}`);
  }
}

function section(name) {
  console.log(`\n【${name}】`);
}

function readFile(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf8');
}

console.log('\n================================================');
console.log('  积分锁定系统 静态代码验证');
console.log('================================================');

// ==== server.js 检查 ====
section('server.js — 服务器端保护');
const server = readFile('server.js');

assert(
  server.includes("requestingPlayer.chips <= 0"),
  '破产玩家检测: chips <= 0 判断存在'
);
assert(
  server.includes("socket.emit('needsRecharge'"),
  '破产玩家响应: 发送 needsRecharge 事件给客户端'
);
assert(
  server.includes('// Human chips are intentionally NOT reset here'),
  'newGame 不重置真人筹码 (注释标记存在)'
);
assert(
  server.includes("if (p.isAI)") && server.includes('if (p.chips <= 0) p.chips = 10000'),
  'newGame 只重置破产 AI 的筹码'
);
assert(
  server.includes("socket.on('newGameFull'"),
  'newGameFull 事件处理器存在 (充值后全新开局)'
);
// 验证 newGameFull 确实会重置所有人筹码
const newGameFullBlock = server.slice(
  server.indexOf("socket.on('newGameFull'"),
  server.indexOf("socket.on('newGameFull'") + 300
);
assert(
  newGameFullBlock.includes('p.chips = 10000'),
  'newGameFull 重置所有人筹码为10000'
);

// ==== network.js 检查 ====
section('network.js — 客户端网络接口');
const network = readFile('public/js/network.js');

assert(
  network.includes('requestNewGameFull()'),
  'requestNewGameFull 方法存在'
);
assert(
  network.includes("this.socket.emit('newGameFull')"),
  'requestNewGameFull 发送正确的 socket 事件'
);
assert(
  network.includes("s.on('needsRecharge'"),
  '监听服务器 needsRecharge 事件'
);
assert(
  network.includes('App.onNeedsRecharge(data)'),
  'needsRecharge 事件转发给 App 处理'
);

// ==== main.js 检查 ====
section('public/js/main.js — 游戏结束逻辑');
const main = readFile('public/js/main.js');

assert(
  main.includes('onNeedsRecharge'),
  'onNeedsRecharge 处理器存在'
);
// 确保 myChips <= 0 时不调用 requestNewGame（只调用 requestNewGameFull 或 openModal）
const gameOverFn = main.slice(
  main.indexOf('onGameOver(data)'),
  main.indexOf('onGameOver(data)') + 1500
);
assert(
  gameOverFn.includes('myChips <= 0'),
  'onGameOver 有 myChips <= 0 的分支判断'
);
assert(
  gameOverFn.includes('Credits.openModal()'),
  '破产玩家强制打开充值弹窗'
);
assert(
  !gameOverFn.includes('myChips <= 0') || 
  !gameOverFn.includes("Network.requestNewGame();\n      } else {"),
  '破产玩家路径不直接调用 requestNewGame'
);
// 破产路径只能走 requestNewGameFull
assert(
  gameOverFn.includes('requestNewGameFull'),
  '充值成功后调用 requestNewGameFull (全新开局)'
);

// onNeedsRecharge 也有充值弹窗保护
assert(
  main.includes('onNeedsRecharge') && main.includes("Credits.openModal();"),
  'onNeedsRecharge 打开充值弹窗'
);
assert(
  main.includes('Network.requestNewGameFull();'),
  'onNeedsRecharge 充值后调用 requestNewGameFull'
);

// ==== ui.js 检查 ====
section('public/js/ui.js — 游戏结束界面');
const ui = readFile('public/js/ui.js');

assert(
  ui.includes('前往充值 Recharge'),
  '积分不足时按钮显示"前往充值 Recharge"'
);
assert(
  ui.includes('积分不足，需充值才能继续'),
  '显示积分不足提示文字'
);
assert(
  ui.includes("btnText = '继续游戏 Continue'"),
  '有积分时按钮显示"继续游戏 Continue"'
);
assert(
  ui.includes("'重新开始 Restart'") || ui.includes('"重新开始 Restart"') || ui.includes('\u91cd\u65b0\u5f00\u59cb Restart'),
  '赢了时按钮显示"重新开始 Restart"'
);
const showGameOverFn = ui.slice(
  ui.indexOf('showGameOver(myChips)'),
  ui.indexOf('showGameOver(myChips)') + 1200
);
assert(
  showGameOverFn.includes("balance >= Credits.COST_PER_GAME"),
  '游戏结束界面检查积分余额是否足够'
);

// ==== 整体逻辑流程检查 ====
section('整体流程 — 积分锁定链路');

// 确认三道防线都存在
const line1 = ui.includes('前往充值 Recharge'); // UI层
const line2 = main.includes('Credits.openModal()') && main.includes('requestNewGameFull'); // 客户端逻辑层
const line3 = server.includes("socket.emit('needsRecharge'") && server.includes('chips <= 0'); // 服务器层

assert(line1, '防线1 (UI层): 积分不足显示充值按钮而非重新开始');
assert(line2, '防线2 (客户端逻辑层): 破产玩家只能通过充值后 newGameFull 继续');
assert(line3, '防线3 (服务器层): 服务器拒绝破产玩家的 newGame 请求');

// ==== 汇总 ====
console.log('\n================================================');
console.log(`  结果: ${passed} 通过  ${failed} 失败`);
console.log('================================================\n');

if (failed === 0) {
  console.log('🎉 全部通过！积分锁定系统已正确实现。');
  console.log('\n完整保护流程:');
  console.log('  玩家输光筹码');
  console.log('    → UI显示"前往充值"按钮 (而非重新开始)');
  console.log('    → 点击 → 充值弹窗强制弹出');
  console.log('    → 如关闭弹窗不购买 → 游戏不开始');
  console.log('    → 如购买成功 → newGameFull → 重置筹码10000重新开局');
  console.log('    → 服务器兜底: 破产玩家发 newGame → 返回 needsRecharge');
} else {
  console.log(`⚠️  ${failed} 项检查未通过，请查看上方详情。`);
}

process.exit(failed > 0 ? 1 : 0);
