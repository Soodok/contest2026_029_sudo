// BtTransfer.js —— 蓝牙动态资料集接收器（v1.16.46 主人需求）
// ─────────────────────────────────────────────────────────────────
// 【触发逻辑】应用级全局生效：app.ux onCreate 调 initBtReceiver() 挂 interconnect
// 监听，任何界面收到传输都会触发（不是特定页面触发）。
//
// 【传输协议】（手机 App / ble_tools → 手环 interconnect onmessage，JSON 文本帧）：
//   {t:'ds-begin', ds:'<集目录名>', name:'<显示名>', total:<文件数>}
//   {t:'ds-chunk', ds, f:'<文件名>', i:<分片号>, last:0|1, data:'<文本片段>'}   // 大文件分片拼装
//   {t:'ds-end',   ds}                                                        // 全部就绪 → 触发加载
// 引擎所需完整文件集：meta.txt + map_N.txt + detail_N.txt + block_0.txt（见 docs/资料拆分指南.md）。
//
// 【落盘位置】internal://files/datasets/<ds>/ —— @system.file 沙箱，运行时可写可读；
// /common/ 是 rpk 打包只读资源目录，运行时不可写，所以蓝牙集必须落沙箱。
// 引擎按 basePath 读文件，沙箱 URI 直接可用（DatasetManager ds.baseUri 支持）。
//
// 【加载触发】ds-end 收齐 → registerDynamicDataset 注册（全局生效，搜索/详情立即可达）
// → router.replace('/pages/loading?source=bt&ds=<ds>') → loading 页【只】对该集
// 建缓存（_lazyInit + _ensureMap + _ensureChunk），不跑历史集 init、不跑全量预热。
'use strict'

var receiving = null // { ds, name, total, files: {fname: {chunks:{i:data}, got, last}} }

// v1.16.66 传输状态（主人需求：专门蓝牙传输界面）：
// 供 pages/btransfer 轮询显示——phase: idle/receiving/saving/done/error/aborted
var transfer = { phase: 'idle', ds: '', dsId: '', name: '', total: 0, done: 0, currentFile: '', error: '' }
function getTransferState() { return transfer }
function _resetTransfer() { transfer = { phase: 'idle', ds: '', dsId: '', name: '', total: 0, done: 0, currentFile: '', error: '' } }
var registered = false

function _log(msg, level) {
  console.log('[BT-DS] ' + msg)
  try { if (typeof global !== 'undefined' && global.addRuntimeLog) global.addRuntimeLog('[蓝牙资料] ' + msg, level || 'info') } catch (e) {}
}

function baseDir(ds) {
  return 'internal://files/datasets/' + ds + '/'
}

// 单文件落盘（分片按序拼装后一次性 writeText）
function flushFile(ds, fname, parts) {
  return new Promise(function(resolve, reject) {
    try {
      var file = require('@system.file')
      var dir = baseDir(ds)
      file.mkdir({ uri: dir, recursive: true, success: function() {
        var body = ''
        var i = 0
        while (parts[i] !== undefined) { body += parts[i]; i++ }
        file.writeText({
          uri: dir + fname,
          text: body,
          success: function() { resolve() },
          fail: function(err, code) { reject(new Error('writeText fail code=' + code)) }
        })
      }, fail: function(err, code) { reject(new Error('mkdir fail code=' + code)) } })
    } catch (e) { reject(e) }
  })
}

// 处理一条 interconnect 消息（JSON 帧，见头部协议）
// ⚠️ 消息形态双兼容（审查修复）：官方互联层可能以 {data:'<json>'} 包装投递
//（AssistantEngine 即按 data.data 解析），也可能直接投递裸字符串/对象——
// 两种形态都兜住，真机联调无需再改。
function handleMessage(data) {
  var payload = data
  if (data && typeof data === 'object' && typeof data.data === 'string') payload = data.data
  var msg
  try { msg = typeof payload === 'string' ? JSON.parse(payload) : payload } catch (e) { return }
  if (!msg || !msg.t) return

  if (msg.t === 'ds-begin') {
    receiving = { ds: String(msg.ds || ''), name: String(msg.name || msg.ds || ''), total: msg.total || 0, files: {} }
    // 进入专门传输界面（无退出入口，只能手机端停止或传完）
    transfer = { phase: 'receiving', ds: receiving.ds, dsId: '', name: receiving.name, total: receiving.total, done: 0, currentFile: '', error: '' }
    try { require('@system.router').replace({ uri: '/pages/btransfer' }) } catch (e) {}
    _log('开始接收资料集: ' + receiving.ds + '（' + receiving.total + ' 个文件）')
  } else if (msg.t === 'ds-chunk' && receiving && receiving.ds === String(msg.ds || '')) {
    var fname = String(msg.f || '')
    if (!fname) return
    var rec = receiving.files[fname] || (receiving.files[fname] = { chunks: {}, got: 0, last: false })
    var idx = msg.i || 0
    if (rec.chunks[idx] === undefined) { rec.chunks[idx] = String(msg.data || ''); rec.got++ }
    transfer.currentFile = fname
    if (msg.last && !rec.last) { rec.last = true; transfer.done++ }
    else if (msg.last) rec.last = true
  } else if (msg.t === 'ds-file' && receiving && receiving.ds === String(msg.ds || '')) {
    // 单帧整文件（小文件可不切片）。空文件名防护（审查修复）：空名会让后续
    // flushFile 对目录本身 writeText → 整批落盘失败
    var fname2 = String(msg.f || '')
    if (!fname2) return
    if (!receiving.files[fname2]) transfer.done++
    receiving.files[fname2] = { chunks: { 0: String(msg.data || '') }, got: 1, last: true }
    transfer.currentFile = fname2
  } else if (msg.t === 'ds-abort') {
    // 手机端主动停止（主人定案：传输中唯一退出途径）——回首页
    _log('手机端已停止传输', 'warn')
    receiving = null
    _resetTransfer()
    transfer.phase = 'aborted'
    try { require('@system.router').replace({ uri: '/pages/index' }) } catch (e) {}
  } else if (msg.t === 'ds-end' && receiving && receiving.ds === String(msg.ds || '')) {
    var ds = receiving.ds
    var name = receiving.name
    var files = receiving.files
    var declared = receiving.total || 0
    receiving = null
    // ⚠️ 完整性校验（审查修复#4）：interconnect 不保证可靠有序——缺片/缺文件时落盘
    // 会静默产生坏文件（条目搜不到/详情错乱）。校验不通过则拒绝落盘并告警（请重发）。
    var names = Object.keys(files)
    var incomplete = []
    for (var fi = 0; fi < names.length; fi++) {
      var rec0 = files[names[fi]]
      if (!rec0.last) { incomplete.push(names[fi] + '(未收完)'); continue }
      for (var ci = 0; ci < rec0.got; ci++) {
        if (rec0.chunks[ci] === undefined) { incomplete.push(names[fi] + '(缺片#' + ci + ')'); break }
      }
    }
    if (declared > 0 && names.length !== declared) {
      incomplete.push('文件数不符(声明' + declared + '/实收' + names.length + ')')
    }
    if (incomplete.length) {
      transfer.phase = 'error'
      transfer.error = '资料不完整：' + incomplete.join('、') + '（请在手机端重发）'
      _log('资料集 ' + ds + ' 完整性校验失败，拒绝落盘: ' + incomplete.join('、') + '（请重新发送）', 'error')
      return
    }
    transfer.phase = 'saving'
    _log('接收完成: ' + ds + '，共 ' + names.length + ' 个文件，校验通过，落盘中…')
    var chain = Promise.resolve()
    Object.keys(files).forEach(function(fn) {
      chain = chain.then(function() { return flushFile(ds, fn, files[fn].chunks) })
    })
    chain.then(function() {
      _log('落盘完成: internal://files/datasets/' + ds + '/', 'success')
      var DatasetManager = require('./DatasetManager.js')
      var dsObj = DatasetManager.registerDynamicDataset({ dirName: ds, name: name })
      // 状态置 done（含 dsId）——由传输页检测后跳 loading 单集建缓存（v1.16.66）
      transfer.phase = 'done'
      transfer.dsId = String(dsObj.id)
      transfer.done = names.length
    }).catch(function(e) {
      transfer.phase = 'error'
      transfer.error = '保存失败：' + (e && e.message ? e.message : '未知')
      _log('落盘失败: ' + (e && e.message), 'error')
    })
  }
}

// 应用级监听（app.ux onCreate 调一次；重复调用幂等）
// ⚠️ 包装链（审查修复）：AssistantEngine 也在这条通道上设 conn.onmessage（语音/AI 真链路），
// 直接赋值会互相覆盖（后设者赢，另一模块静默失效）。此处保留原 handler 并转发，
// 无论设置顺序如何，两个模块都能收到消息。
function initBtReceiver() {
  if (registered) return false
  try {
    var interconnect = require('@system.interconnect')
    var conn = interconnect.instance()
    var prevHandler = conn.onmessage
    conn.onmessage = function(data) {
      try { handleMessage(data) } catch (e) { _log('消息处理异常: ' + (e && e.message), 'error') }
      // 转发给此前的监听者（如 AssistantEngine 的语音/AI 应答处理）
      if (typeof prevHandler === 'function') {
        try { prevHandler(data) } catch (e) {}
      }
    }
    registered = true
    _log('蓝牙资料接收器已就绪（应用级全局监听）', 'success')
    return true
  } catch (e) {
    _log('interconnect 不可用，接收器未启动（模拟器/无蓝牙环境自动静默）', 'warn')
    return false
  }
}

module.exports = { initBtReceiver: initBtReceiver, handleMessage: handleMessage, baseDir: baseDir, getTransferState: getTransferState }
