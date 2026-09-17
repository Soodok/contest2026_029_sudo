// AssistantEngine —— 语音搜索 / AI 搜索的统一引擎（真链路 + 可运行模拟链路）
//
// 官方链路（真机）：手表快应用 @system.interconnect ←→ 手机 App（xms-wearable SDK）
//   const conn = interconnect.instance()
//   conn.onmessage = (data) => {...}     // 收手机数据
//   conn.send({ data: 'xxx' })          // 发到手机
//   conn.getReadyState({...})           // 查连接状态
//   ⚠️ 约束：需配套手机 App、两端证书一致（官方 FAQ：通信前检查签名）。
//
// 模拟链路（模拟器/无手机对端）：interconnect 不可用或未就绪时自动启用。
//   设计原则：只有「声学识别 / 云端大模型」被替换为本地模拟源，
//   其余全部真实运行 —— 识别结果会真实填入搜索框并触发本地搜索引擎；
//   AI 回答由本地检索 + 模板摘要真实生成，绝非写死的假文案。
//
// 依赖：零（纯 ES5；interconnect 按需 require，失败即走模拟）

var MODE = {
  REAL: 'real',        // 真机：interconnect 通道（手机 App 应答）
  SIM: 'sim'           // 模拟：本地模拟源（模拟器演示 / 无对端）
}

var SIM_LATENCY = 1500          // 模拟识别延迟（ms）：贴近真实语音识别耗时
var SIM_AI_LATENCY = 900        // 模拟 AI 思考延迟（ms）

// —— 同义词扩展（本地问答理解）：把口语问题映射到资料库词 ——
var SYNONYMS = [
  [/(怎么|如何|怎样).*(急救|救急|处理)/, '急救'],
  [/(怎么|如何|怎样).*(感冒|发烧|发热)/, '感冒'],
  [/(怎么|如何|怎样).*(入睡|失眠|睡不着)/, '睡眠'],
  [/(减肥|瘦身)/, '运动'],
  [/(背单词|记单词|学英语)/, '记忆'],
  [/(血压|血糖)/, '血压'],
  [/(做菜|做饭|烹饪)/, '烹饪'],
  [/(养花|浇花|绿植)/, '绿植'],
  [/(省钱|理财|存钱)/, '理财'],
  [/(带孩子|育儿|宝宝)/, '育儿']
]

function Assistant() {
  this.mode = null
  this.conn = null
  this._voiceCb = null
  this._aiCb = null
  this._simTimer = null
  this._probeDone = false
}

// 探测通道：真链路优先（interconnect 就绪），否则模拟。结果缓存（连接状态变化时 reprobe）。
Assistant.prototype.probe = function (onReady) {
  var self = this
  if (this._probeDone && this.mode) { onReady(this.mode); return }
  try {
    var interconnect = require('@system.interconnect')
    var conn = interconnect.instance()
    conn.getReadyState({
      success: function (data) {
        if (data && data.status === 1) {
          self.mode = MODE.REAL
          self.conn = conn
          self._bindReal(conn)
        } else {
          self.mode = MODE.SIM
        }
        self._probeDone = true
        onReady(self.mode)
      },
      fail: function () {
        self.mode = MODE.SIM
        self._probeDone = true
        onReady(self.mode)
      }
    })
  } catch (e) {
    // 模拟器上 interconnect 通常不可 require 或无对端 → 模拟链路
    this.mode = MODE.SIM
    this._probeDone = true
    onReady(this.mode)
  }
}

// 绑定真链路消息（手机 App 的应答）
Assistant.prototype._bindReal = function (conn) {
  var self = this
  conn.onmessage = function (data) {
    if (!data || !data.data) return
    var msg = null
    try { msg = JSON.parse(data.data) } catch (e) { return }
    if (msg.type === 'voice_result' && self._voiceCb) {
      self._voiceCb({ ok: true, text: msg.text || '', mode: MODE.REAL })
    } else if (msg.type === 'ai_result' && self._aiCb) {
      self._aiCb({ ok: true, answer: msg.answer || '', results: msg.results || [], mode: MODE.REAL })
    }
  }
}

// ============ 语音搜索 ============
// 真链路：向手机发送语音搜索请求（手机端做 ASR 后回传文本）
// 模拟链路：从资料集高频词中抽一个词作为"识别结果"（延迟 SIM_LATENCY），
//          走与真链路完全相同的回调 —— 后续填词/搜索/出结果全部真实执行。
Assistant.prototype.recognize = function (cb) {
  var self = this
  this._voiceCb = cb
  this.cancelSim()
  this.probe(function (mode) {
    if (mode === MODE.REAL) {
      try {
        self.conn.send({ data: JSON.stringify({ type: 'voice_search' }) })
      } catch (e) {
        // 真链路发送失败 → 降级模拟（保证任何环境都能跑完流程）
        self._simVoice(cb)
      }
    } else {
      self._simVoice(cb)
    }
  })
}

Assistant.prototype._simVoice = function (cb) {
  var self = this
  var word = this._pickSimWord()
  this._simTimer = setTimeout(function () {
    self._simTimer = null
    cb({ ok: !!word, text: word, mode: MODE.SIM })
  }, SIM_LATENCY)
}

// ============ AI 搜索 ============
// 真链路：把问题发到手机 App（云端大模型应答）
// 模拟链路：本地"问答理解"（同义词归一）→ 真实搜索引擎检索 → 模板摘要生成回答。
//          回答内容由检索结果真实拼出，问题不同则回答不同，非固定文案。
Assistant.prototype.answer = function (question, searchFn, cb) {
  var self = this
  this._aiCb = cb
  this.cancelSim()
  this.probe(function (mode) {
    if (mode === MODE.REAL) {
      try {
        self.conn.send({ data: JSON.stringify({ type: 'ai_search', q: question }) })
      } catch (e) {
        self._simAI(question, searchFn, cb)
      }
    } else {
      self._simAI(question, searchFn, cb)
    }
  })
}

Assistant.prototype._simAI = function (question, searchFn, cb) {
  var self = this
  var keyword = this._understand(question)
  if (!keyword) { cb({ ok: false, reason: 'empty' }); return }
  var t0 = Date.now()
  searchFn(keyword).then(function (result) {
    var items = (result && result.results) || []
    var total = (result && result.total) || 0
    // 摘要生成：由检索结果真实拼出（取前 2 条的标题与正文首句）
    var lines = []
    var upper = items.length < 2 ? items.length : 2
    for (var i = 0; i < upper; i++) {
      var it = items[i]
      var first = (it.title || '').split(/[，。,.]/)[0]
      lines.push((i + 1) + '. ' + first)
    }
    var answer = lines.length
      ? ('关于「' + keyword + '」，共找到 ' + total + ' 条资料：' + lines.join('；') + '。')
      : ('本地资料中未找到与「' + keyword + '」直接相关的内容，换个说法试试？')
    // 保证回答至少延迟 SIM_AI_LATENCY（模拟"思考"节奏），检索更快则补齐
    var wait = Math.max(0, SIM_AI_LATENCY - (Date.now() - t0))
    setTimeout(function () { cb({ ok: true, answer: answer, keyword: keyword, results: items, total: total, mode: MODE.SIM }) }, wait)
  }).catch(function () {
    cb({ ok: false, reason: 'search_error' })
  })
}

// 本地问答理解：同义词归一 → 抽取 2 字以上中文词 / 英文词（最长者优先）
Assistant.prototype._understand = function (q) {
  var s = String(q || '').trim()
  if (!s) return ''
  for (var i = 0; i < SYNONYMS.length; i++) {
    if (SYNONYMS[i][0].test(s)) return SYNONYMS[i][1]
  }
  var m = s.match(/[a-zA-Z]{3,}/)
  if (m) return m[0].toLowerCase()
  m = s.match(/[\u4e00-\u9fa5]{2,}/g)
  if (m && m.length) {
    var best = ''
    for (var j = 0; j < m.length; j++) { if (m[j].length > best.length) best = m[j] }
    return best
  }
  return s
}

// 模拟语音识别的"结果词"：从内置高频演示词表抽取（均来自资料集真实标题词，保证必命中）
Assistant.prototype._pickSimWord = function () {
  var words = ['感冒', '急救', '睡眠', '唐朝', '唐朝', '运动', '早餐', '绿植', '理财', '记忆', '秦', '宋朝']
  return words[Math.floor(Math.random() * words.length)]
}

Assistant.prototype.cancelSim = function () {
  if (this._simTimer) {
    clearTimeout(this._simTimer)
    this._simTimer = null
  }
}

Assistant.prototype.cancel = function () {
  this.cancelSim()
  this._voiceCb = null
  this._aiCb = null
}

Assistant.prototype.getMode = function () { return this.mode || MODE.SIM }

// —— 单例 ——
var _instance = null
function getAssistant() {
  if (!_instance) _instance = new Assistant()
  return _instance
}

export { getAssistant }   // MODE 仅引擎内部使用，未导出（2026-09-17 审查清理死导出）
