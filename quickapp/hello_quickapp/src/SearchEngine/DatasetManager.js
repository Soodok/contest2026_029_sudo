// DatasetManager —— 资料集注册表 + 多实例引擎池 + 跨集搜索聚合
// 架构见 docs/2026-09-05-资料集模块化规范v1.md
// 每个资料集一个 SearchEngine 实例（零改动复用已验证的单集逻辑），
// 全局 ID = (datasetId << 20) | localId
import { SearchEngine } from './SearchEngine.js'

// 资料集注册清单（内置集；蓝牙动态集由手机端下发清单后追加到 DYNAMIC_DATASETS）
console.log('[DM] module evaluating')
// 6 标签 = 6 数据集（主人定的精简架构：集数=标签数，搜索只需遍历 6 个集，
// 不再是原先 24 集跨集聚合——那套导致搜索慢、缓存大、清缓存耗时、命中率低）
var DATASETS = [
  { id: 0, folder: '', name: '历史', tag: '历史', icon: '/common/icons/history.png',
    desc: '世界历史大事记，覆盖六大洲从史前到现代的关键事件',
    tags: [ { label: '亚洲', value: 'asia' }, { label: '欧洲', value: 'europe' },
            { label: '非洲', value: 'africa' }, { label: '其他', value: 'other' },
            { label: '南美洲', value: 'south_america' }, { label: '北美洲', value: 'north_america' } ] },
  { id: 1, folder: 'datasets/poems/', name: '诗词', tag: '诗词', icon: '/common/datasets/poems/icon.png',
    desc: '中国古诗词名篇，含朝代、作者与全文',
    tags: [ { label: '诗', value: '诗' }, { label: '词', value: '词' }, { label: '先秦', value: '先秦' },
            { label: '魏晋', value: '魏晋' }, { label: '唐朝', value: '唐朝' }, { label: '五代', value: '五代' },
            { label: '宋朝', value: '宋朝' }, { label: '元朝', value: '元朝' }, { label: '清朝', value: '清朝' } ] },
  { id: 2, folder: 'datasets/english/', name: '英语', tag: '英语', icon: '/common/datasets/english/icon.png',
    desc: 'CET-4/6 核心词汇，含词性与中文释义',
    tags: [ { label: '四级', value: '四级' }, { label: '六级', value: '六级' } ] },
  { id: 3, folder: 'datasets/health/', name: '健康', tag: '健康', icon: '/common/datasets/health/icon.png',
    desc: '健康养生、心理情绪、急救、护肤美妆与运动知识',
    tags: [ { label: '健康', value: '健康' }, { label: '心理情绪', value: '心理情绪' },
            { label: '急救', value: '急救' }, { label: '护肤美妆', value: '护肤美妆' },
            { label: '运动', value: '运动' } ] },
  { id: 4, folder: 'datasets/life/', name: '生活', tag: '生活', icon: '/common/datasets/life/icon.png',
    desc: '厨房烹饪、居家清洁、出行旅游、育儿养老等生活常识',
    tags: [ { label: '亲子育儿', value: '亲子育儿' }, { label: '出行旅游', value: '出行旅游' },
            { label: '厨房烹饪', value: '厨房烹饪' }, { label: '宠物照料', value: '宠物照料' },
            { label: '房屋维修', value: '房屋维修' }, { label: '民俗常识', value: '民俗常识' },
            { label: '烟酒茶饮', value: '烟酒茶饮' }, { label: '理财省钱', value: '理财省钱' },
            { label: '生活居家', value: '生活居家' }, { label: '绿植养护', value: '绿植养护' },
            { label: '职场办公', value: '职场办公' }, { label: '节气节日', value: '节气节日' },
            { label: '衣物打理', value: '衣物打理' } ] },
  { id: 5, folder: 'datasets/study/', name: '学习', tag: '学习', icon: '/common/datasets/study/icon.png',
    desc: '学习效率、手机数码与百科知识',
    tags: [ { label: '学习效率', value: '学习效率' }, { label: '手机数码', value: '手机数码' },
            { label: '百科', value: '百科' } ] }
]

var engines = {}

// 大类分组映射（首页只渲染这几个入口——真机上 image 元素一多就卡死，24 个集压到 6 个入口）
// ⚠️ 每组都必须声明 datasets（含只有单集的组）：searchAllAsync 的组过滤遇到 g.datasets 缺失
//    会 continue 掉该组所有集 = 点进去搜不到任何结果
// 6 标签 ↔ 6 数据集（1:1，与 DATASETS 的 id 对齐——集数=标签数，不再需要跨集聚合分组）
var GROUP_MAP = {
  0: { name: '历史', icon: '/common/icons/history.png', colorClass: 'ci-orange', datasets: [0] },
  1: { name: '诗词', icon: '/common/datasets/poems/icon.png', colorClass: 'ci-ds', datasets: [1] },
  2: { name: '英语', icon: '/common/datasets/english/icon.png', colorClass: 'ci-blue', datasets: [2] },
  3: { name: '健康', icon: '/common/datasets/health/icon.png', colorClass: 'ci-green', datasets: [3] },
  4: { name: '生活', icon: '/common/datasets/life/icon.png', colorClass: 'ci-cyan', datasets: [4] },
  5: { name: '学习', icon: '/common/datasets/study/icon.png', colorClass: 'ci-yellow', datasets: [5] }
}

// 首页分类行：大类入口清单（替代 20+ 个独立集入口）
function getGroupEntries() {
  var entries = []
  var ids = Object.keys(GROUP_MAP).map(Number).sort(function(a, b) { return a - b })
  for (var i = 0; i < ids.length; i++) {
    var g = GROUP_MAP[ids[i]]
    // ⚠️ v1.16.49 回退「整类名变量」写法：轻量运行时对 classList 返回数组的路径会丢类
    //（实测分类图标底色消失）——恢复「固定类 + 变量类」拼接（线上多版本验证 OK）
    entries.push({ name: g.name, icon: g.icon, colorClass: g.colorClass, isGroup: true, groupId: ids[i] })
  }
  return entries
}

// 按大类获取所有资料集 ID 列表
function getDatasetIdsByGroup(groupId) {
  var g = GROUP_MAP[groupId]
  if (!g || !g.datasets) return []
  return g.datasets
}

function ensureEngine(ds) {
  if (!engines[ds.id]) {
    var e = new SearchEngine()
    // ⚠️ 关键：深拷贝 config——所有实例共享模块常量 C，直接改会互相污染；
    // 且缓存 key 必须按集隔离（keyPrefix 加 ds 后缀），否则各集块缓存同名互相覆盖串数据
    var cloned = JSON.parse(JSON.stringify(e.config))
    cloned.blockBinary.enabled = false
    cloned.cache.keyPrefix = cloned.cache.keyPrefix + '_ds' + ds.id
    cloned.mapCache.keyPrefix = cloned.mapCache.keyPrefix + '_ds' + ds.id
    e.config = cloned
    // 蓝牙动态集在应用沙箱（internal://files/，运行时可写），内置集在 /common/（rpk 只读）
    e.basePath = ds.baseUri ? ds.baseUri : ('/common/' + ds.folder)
    if (e.basePath.charAt(e.basePath.length - 1) !== '/') e.basePath += '/'
    engines[ds.id] = e
  }
  return engines[ds.id]
}

// 注册蓝牙传输的动态资料集（v1.16.46）：追加到 DATASETS 后全局生效——
// searchAllAsync 遍历 DATASETS（搜索可达）、getItemByGlobalId（详情可达）自动覆盖。
// id 从 100 起避让内置集；重复传输同目录幂等（返回已有项，缓存按版本自动重建）。
var DYN_ID_BASE = 100
function registerDynamicDataset(opt) {
  for (var i = 0; i < DATASETS.length; i++) {
    if (DATASETS[i].dirName === opt.dirName) return DATASETS[i]
  }
  var maxId = DYN_ID_BASE - 1
  for (var j = 0; j < DATASETS.length; j++) if (DATASETS[j].id > maxId) maxId = DATASETS[j].id
  var ds = {
    id: maxId + 1,
    dirName: opt.dirName,
    folder: '',
    baseUri: 'internal://files/datasets/' + opt.dirName + '/',
    name: opt.name || opt.dirName,
    tag: opt.name || opt.dirName,
    icon: '/common/datasets/bt/icon.png',
    desc: '蓝牙传输资料集',
    tags: []
  }
  DATASETS.push(ds)
  console.log('[DM] 动态资料集已注册: id=' + ds.id + ' ' + ds.name + ' baseUri=' + ds.baseUri)
  return ds
}

// 首页资料入口动态清单：已注册的资料集 = 真实存在的资料（图标/名称/集ID）
function getDatasetEntries() {
  console.log('[DM] getDatasetEntries called, DATASETS=' + (typeof DATASETS !== 'undefined' ? DATASETS.length : 'UNDEFINED'))
  var entries = []
  for (var i = 0; i < DATASETS.length; i++) {
    var ds = DATASETS[i]
    entries.push({
      name: ds.name,
      icon: ds.icon,
      colorClass: 'ci-ds',
      dsId: ds.id,
      isDataset: true
    })
  }
  return entries
}

function encodeGlobalId(dsId, localId) {
  return (dsId * 1048576) + localId
}

function decodeGlobalId(gid) {
  return { dsId: Math.floor(gid / 1048576), localId: gid % 1048576 }
}

// 异步聚合（跨集分页语义 = 全局第 N 页：各集拉 1..page 页，按注册表顺序稳定排序后切片）
async function searchAllAsync(query, options) {
  options = options || {}
  var pageSize = options.pageSize || 20
  var page = options.page || 1
  var onlyDsId = (options.datasetId !== undefined && options.datasetId !== null) ? options.datasetId : null
  // 大类入口筛选（首页大类按 GROUP_MAP 聚合时传入；未传 = null 不限集）
  var onlyGroup = (options.groupId !== undefined && options.groupId !== null) ? options.groupId : null
  // 分类/地区筛选透传（历史集 v4 语义：引擎内按 categoryList/regionList 匹配）
  var category = (options.category !== undefined && options.category !== null) ? options.category : 'all'
  var region = (options.region !== undefined && options.region !== null) ? options.region : 'all'
  var merged = []
  var total = 0
  var initFailed = false

  // 各集搜索并行发起（此前串行 await 24 次，首次搜索还要逐集懒初始化 → 明显卡顿）
  var tasks = []
  for (var i = 0; i < DATASETS.length; i++) {
   (function(i) {
    var ds = DATASETS[i]
    if (onlyDsId !== null && ds.id !== onlyDsId) return
    if (onlyGroup !== null) {
      var g = GROUP_MAP[onlyGroup]
      if (!g || !g.datasets || g.datasets.indexOf(ds.id) === -1) return
    }
    // ⚠️ 分类/地区筛选只对历史集生效：资料集 meta 的 categoryList 为空，
    // 透传给引擎会把该集结果全部滤掉（categoryList[undefined] !== category 恒真）；
    // 筛选激活时只搜历史集（与聚合改造前的单集搜索行为一致）
    // 标签筛选（region）对【所有集】生效：各集 meta 的 regionList 都非空（历史集=六大洲、
    // 生活集=13 个分类……），引擎按 this.regionList[info.regionId] 比对，资料集同样可用。
    // 仅 category 筛选仍限历史集（资料集 categoryList 为空，且需逐条 loadDetail 读文件，性能差）。
    if (category !== 'all' && ds.id !== 0) return
    // ⚠️ 每个集独立超时（v1.16.23）：快应用下 file.readText 回调可能丢失（#18/#84），
    // 单集卡住会让 Promise.all 永久挂起 → 上层页面 loading 恒 true（「一直搜索中」）。
    // 这里给每个集 8s 上限，超时按「该集无结果」处理，不影响其余集。
    tasks.push(Promise.race([
      (async function() {
      var eng = ensureEngine(ds)
    // ⚠️ 一次拉够 page 页的量（v1.16.25 优化）：原先 for (pg=1..page) 让「每集的引擎
    // 调用次数 = 页码」，翻到第 3 页即 6 集×3 = 18 次调用（真机上成倍放大）。
    // 现每集只调用一次、取前 pageSize*page 条，再交由下方全局切片与交错排序。
    var r = await eng.search(query, { page: 1, pageSize: pageSize * page, category: category, region: region })
    if (r && r.initFailed) initFailed = true
    var items = (r && r.results) || []
    total += (r && r.total) || 0
    var card = (eng.display && eng.display.card) || null
    var mainField = (card && card.mainField) || 'year'
    var rows = (card && card.rows) || null
      for (var j = 0; j < items.length; j++) {
        var it = items[j]
        it.globalId = encodeGlobalId(ds.id, it.id)
        it.datasetTag = ds.tag
        // 主字段≠year 时，卡片第一行显示主字段值（学段/分类值在 region 里）
        if (mainField !== 'year') {
          it.yearDisplay = it.region || ds.tag
          // 第三行改显集标签：meta.display.card 第三行 ref 与首行同源，
          // 直接透传 region 会和首行重复显示（英语集两行都是「初中/高中」）
          it.region = ds.tag
        } else if (ds.id !== 0) {
          // 非历史集无年份语义（物化 year=0 会显示「公元元年」）——卡片年份位改显集标签
          it.yearDisplay = ds.tag
        }
        // 卡片三行大小（meta.display.card.rows → UI 渲染）
        // ⚠️ 手环9固件雷：模板里 class="a sz-{{$item.x}}" 拼接表达式会让 DOM 属性设置崩
        // （Unsupported type for setDomAttributes）——必须在此预拼完整类名，模板只做纯变量插值。
        // 未声明 display.card 的集（历史/诗词）不下发 sz 类，保持页面 CSS 形态基准，不改变现有观感
        var sz0 = (card && rows[0]) ? rows[0].size : ''
        var sz1 = (card && rows[1]) ? rows[1].size : ''
        var sz2 = (card && rows[2]) ? rows[2].size : ''
        it.yearClass = 'result-year' + (sz0 ? ' sz-' + sz0 : '')
        it.titleClass = 'result-title' + (sz1 ? ' sz-' + sz1 : '')
        it.catClass = 'result-region' + (sz2 ? ' sz-' + sz2 : '')
        it._dsOrder = i
        // 该集内条目序号（交错排序依据）
        it._seq = j
        merged.push(it)
      }
      })(),
      new Promise(function(resolve) { setTimeout(function() { resolve(null) }, 8000) })
    ]))
   })(i)
  }
  await Promise.all(tasks)

  // 交错排序：各集第 1 条 → 各集第 2 条 → …（此前按集顺序排，第 1 页会被排最前的集整页
  // 占满，其余资料集的结果要翻很多页才露出 = 用户感知「部分条目搜不到」）
  merged.sort(function(a, b) {
    if (a._seq !== b._seq) return a._seq - b._seq
    return a._dsOrder - b._dsOrder
  })
  var start = (page - 1) * pageSize
  var cardSize = 'medium'
  for (var mi = 0; mi < merged.length; mi++) {
    if (merged[mi].titleSize) { cardSize = merged[mi].titleSize; break }
  }
  return { results: merged.slice(start, start + pageSize), total: total, initFailed: initFailed, cardSize: cardSize }
}

// 全局 ID 取详情（跨集路由）
async function getItemByGlobalId(gid) {
  var d = decodeGlobalId(gid)
  var ds = null
  for (var i = 0; i < DATASETS.length; i++) {
    if (DATASETS[i].id === d.dsId) { ds = DATASETS[i]; break }
  }
  if (!ds) return null
  var eng = ensureEngine(ds)
  return await eng.getDoc(d.localId)
}

// 清除全部资料集的 chunk/map/resume 缓存（设置页「关于」连续点四下触发）
// ⚠️ 关键：改用【引擎自己的】clearChunkCache/clearMapCache —— 它们用 _getChunkCacheKey()
//    现算 key，与写入侧 100% 一致。此前手工拼 key（'search_engine__ds{id}v{ver}_chunk_n'）
//    在真机上实测没清掉任何东西（拉取设备 persist.db 无任何 search_engine 键），
//    正是「清完缓存重新加载仍提示有缓存」的根因。
// ⚠️ 但懒加载未 init 的实例 this.chunks/this.maps 为空 → 必须先 _loadMeta() 拿到清单，
//    否则清缓存循环一次都不执行（这也是当初没用引擎方法的原因）。
async function clearAllCaches() {
  var ok = 0, keys = 0
  for (var i = 0; i < DATASETS.length; i++) {
    var ds = DATASETS[i]
    try {
      var eng = ensureEngine(ds)
      // 只读 meta（不构建块），让 chunks/maps 清单就位
      if (typeof eng._loadMeta === 'function') await eng._loadMeta()
      if (typeof eng.clearChunkCache === 'function') await eng.clearChunkCache()
      if (typeof eng.clearMapCache === 'function') await eng.clearMapCache()
      if (typeof eng._clearResumeProgress === 'function') eng._clearResumeProgress()
      keys += (eng.chunks ? eng.chunks.length : 0) + (eng.maps ? eng.maps.length : 0) + 1
      ok++
    } catch (e) {
      console.log('[DM] 清缓存失败 ds=' + ds.id + ': ' + e.message)
    }
  }
  // ⚠️ 额外清理 app.ux 自建引擎实例：其缓存键不含 _ds 后缀（search_engine_v6_chunk_N），
  // 与资料集实例的键不同；不单独清的话历史集（/common）的缓存永远清不掉。
  try {
    var appEng = (typeof global !== 'undefined') ? global.searchEngine : null
    if (appEng && typeof appEng.clearChunkCache === 'function') {
      await appEng.clearChunkCache()
      await appEng.clearMapCache()
    }
  } catch (e) { console.log('[DM] 清理 app 引擎缓存失败: ' + e.message) }

  // 丢弃内存引擎池：下次搜索/加载按当前数据文件重建缓存
  engines = {}
  console.log('[DM] clearAllCaches: 已清理 ' + ok + '/' + DATASETS.length + ' 个数据集，共 ' + keys + ' 个键位（预热标记已清除）')
  return { datasets: DATASETS.length, cleared: ok, keys: keys }
}

// 全量预热（v1.16.43 主人定案，v1.16.44 流式化 + 无条件幂等）：
// 把全部资料集的索引（map+chunk）建好 storage 缓存——此前资料 5 集引擎懒创建
//（首次搜到该集才读块文件+写缓存），总搜索第一次要同时冷启动 5 个集 = 慢的根因。
// ⚠️ 流式约束（主人强调）：手环内存小，禁止 6 集索引同时驻留内存——
// 串行逐集建立，每集建完【立即丢弃该集引擎实例】（内存池随实例释放）再建下一集，
// 只保留 storage 持久缓存；下次搜索 ensureEngine 重建实例，从缓存直读（快）。
// 单集 20s 上限，失败/超时跳过——搜索路径懒加载天然兜底。
// 幂等：每次启动都可安全重跑——已有缓存的集快速读入即弃（内存池重建后随实例释放），
// 缺失的自动补建（自愈，无需任何检查——主人定案：正常情况缓存不会消失）。

async function warmupOne(ds, onProgress, keepAlive) {
  var eng = ensureEngine(ds)
  if (!eng.isReady) await eng._lazyInit()
  if (onProgress) { try { onProgress(30, '读取资料元数据') } catch (e) {} }
  for (var m = 0; m < eng.maps.length; m++) await eng._ensureMap(m)
  if (onProgress) { try { onProgress(60, '建立检索索引') } catch (e) {} }
  for (var c = 0; c < eng.chunks.length; c++) await eng._ensureChunk(c)
  if (!keepAlive) {
    // 流式释放：缓存已持久化，实例内存池（loadedMaps/loadedChunks）随实例一起丢弃
    delete engines[ds.id]
  }
  if (onProgress) { try { onProgress(95, '完成') } catch (e) {} }
}

// 单集预热（蓝牙传输唤醒，v1.16.46）：loading 页只给传输来的文件建缓存。
// keepAlive=保留引擎实例（用户接下来就会搜它，不必重建）
function warmupSingle(dsId, onProgress) {
  var ds = null
  for (var i = 0; i < DATASETS.length; i++) if (DATASETS[i].id === dsId) { ds = DATASETS[i]; break }
  if (!ds) return Promise.reject(new Error('资料集不存在: ' + dsId))
  return warmupOne(ds, onProgress, true)
}

async function warmupAllCaches(onProgress) {
  var done = 0
  for (var i = 0; i < DATASETS.length; i++) {
    var ds = DATASETS[i]
    try {
      await Promise.race([
        (async function() { await warmupOne(ds) })(),
        new Promise(function(r) { setTimeout(r, 20000) })
      ])
    } catch (e) {
      console.log('[DM] 预热跳过 ds=' + ds.id + ': ' + (e && e.message ? e.message : '未知'))
    }
    done++
    if (typeof onProgress === 'function') {
      try { onProgress(Math.round(done / DATASETS.length * 100), '预加载资料 · ' + ds.name) } catch (e) {}
    }
  }
  console.log('[DM] 预热完成 ' + done + '/' + DATASETS.length + ' 集（流式：逐集建缓存逐集释放内存，标记=' + ver + '）')
  return done
}


// 取资料集展示信息（图标/名称/简介/标签）——供首页「资料详情视图」使用
// tags 的 cls 在此预拼（选中态由 pickTag 重设），模板只做纯变量插值
function getDatasetInfo(dsId) {  for (var i = 0; i < DATASETS.length; i++) {
    var ds = DATASETS[i]
    if (ds.id !== dsId) continue
    var tags = []
    var list = ds.tags || []
    for (var j = 0; j < list.length; j++) {
      tags.push({ label: list[j].label, value: list[j].value, cls: 'ds-tag' })
    }
    return { id: ds.id, name: ds.name, icon: ds.icon, desc: ds.desc || '', colorClass: 'ci-ds', tags: tags }
  }
  return null
}

export { DATASETS, ensureEngine, searchAllAsync, getItemByGlobalId, encodeGlobalId, decodeGlobalId, getDatasetEntries, getGroupEntries, getDatasetIdsByGroup, clearAllCaches, getDatasetInfo, warmupAllCaches, registerDynamicDataset, warmupSingle, GROUP_MAP }
