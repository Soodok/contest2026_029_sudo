// test_assistant.js —— AssistantEngine 模拟链路真机单测
// 在 Node 里真实执行：模拟 interconnect 不可用（与模拟器环境一致）→ 自动降级 SIM 链路，
// 验证 recognize/answer 全流程真实运行（非走查、非标注）。
//
// 运行: node tools/test_assistant.js   （退出码 0=全部通过）

// —— mock 快应用环境（模拟器上 interconnect require 失败，与 probe 的 catch 分支一致）——
// AssistantEngine 内部 require('@system.interconnect') 会抛错 → probe 落到 SIM —— 正是要验证的路径。

const path = require('path');
const src = path.join(__dirname, '..', 'src', 'SearchEngine', 'AssistantEngine.js');

// 用 ESM 加载（工程模块为 export 语法）
const Module = require('module');
const fs = require('fs');
let code = fs.readFileSync(src, 'utf-8');
const m = new Module(src, null);
m.filename = src;
m.paths = Module._nodeModulePaths(path.dirname(src));
// 注入 stub require：@system.interconnect 抛错（模拟器同款）
const origRequire = m.require.bind(m);
m.require = function (id) {
  if (id === '@system.interconnect') {
    throw new Error('module not found (模拟器环境：interconnect 不可用)');
  }
  return origRequire(id);
};
m._compile(code, src);
const { getAssistant } = m.exports;

let passed = 0, failed = 0;
function assert(name, cond, detail) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (detail ? ' | ' + detail : '')); }
}

// ============ 用例 1：probe 降级到 SIM ============
console.log('\n[1] probe：interconnect 不可用 → 自动降级模拟链路');
getAssistant().probe(function (mode) {
  assert('mode = sim', mode === 'sim', 'got ' + mode);

  // ============ 用例 2：语音识别（模拟链路真实执行）============
  console.log('\n[2] recognize：模拟识别在延迟后真实回调');
  const t0 = Date.now();
  getAssistant().recognize(function (r) {
    const dt = Date.now() - t0;
    assert('回调 ok=true', r.ok === true);
    assert('识别文本非空', typeof r.text === 'string' && r.text.length > 0, JSON.stringify(r.text));
    assert('链路 mode=sim', r.mode === 'sim');
    assert('延迟 ≈1.5s（' + dt + 'ms）', dt >= 1400 && dt < 4000);

    // ============ 用例 3：AI 问答 —— 同义词理解 + 摘要由检索结果真实拼出 ============
    console.log('\n[3] answer：本地理解→检索→摘要（内容随检索结果变化）');
    // mock 搜索通道（等价 global.searchHistory 的 Promise 形态），返回真实结构的检索结果
    const fakeSearch = function (kw) {
      return Promise.resolve({
        results: [
          { id: 1, title: '感冒的常见处理,多喝水休息', yearDisplay: '健康', region: '健康' },
          { id: 2, title: '发烧时的物理降温方法', yearDisplay: '健康', region: '急救' }
        ],
        total: 2
      });
    };
    getAssistant().answer('怎么预防感冒', fakeSearch, function (r3) {
      assert('回答 ok=true', r3.ok === true);
      assert('同义词理解：怎么预防感冒 → 感冒', r3.keyword === '感冒', 'got ' + r3.keyword);
      assert('回答包含检索计数（共找到 2 条）', r3.answer.indexOf('共找到 2 条') !== -1, r3.answer);
      assert('回答由检索结果拼出（含首条标题首句）', r3.answer.indexOf('感冒的常见处理') !== -1);
      assert('返回来源条目 2 条', r3.results.length === 2);

      // ============ 用例 4：问题不同 → 回答不同（非固定文案）============
      console.log('\n[4] 回答随问题变化（非写死文案）');
      const fakeSearch2 = function (kw) {
        return Promise.resolve({
          results: [{ id: 9, title: '急救黄金四分钟', yearDisplay: '急救' }],
          total: 1
        });
      };
      getAssistant().answer('遇到有人晕倒怎么急救', fakeSearch2, function (r4) {
        assert('同义词理解：晕倒急救 → 急救', r4.keyword === '急救', 'got ' + r4.keyword);
        assert('回答内容不同（含急救条目）', r4.answer.indexOf('急救黄金四分钟') !== -1);
        assert('回答与用例3不同', r4.answer !== r3.answer);

        // ============ 用例 5：空问题 / 检索失败 的边界 ============
        console.log('\n[5] 边界：空问题');
        getAssistant().answer('', fakeSearch, function (r5) {
          assert('空问题 ok=false', r5.ok === false);

          // ============ 用例 6：cancel 取消在途识别 ============
          console.log('\n[6] cancel：取消后不再回调');
          let fired = false;
          getAssistant().recognize(function () { fired = true; });
          getAssistant().cancel();
          setTimeout(function () {
            assert('取消后 1.9s 内未回调', fired === false);
            console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
            process.exit(failed ? 1 : 0);
          }, 1900);
        });
      });
    });
  });
});
