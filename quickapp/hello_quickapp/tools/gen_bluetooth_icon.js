#!/usr/bin/env node
// gen_bluetooth_icon.js —— 「蓝牙未连接」图标（v1.16.54 简版定稿，主人指示）
// 主人最终指示：「直接自己弄一个，暗红色背景加一个红色蓝牙，图标后面再去找官方要」
//   → 简版三要素：① 暗红圆底  ② 红色蓝牙符号（清晰可见）  ③ 斜杠切断符号表断联
// 官方图标拿到后替换 src/common/icons/bluetooth_off.png + 首页尺寸在语音面板样式
//（.voice-bt-off，pill 下 80px）即可，无需改任何代码。
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

// Material Design 官方 bluetooth 图标 path（24x24）——标准 ᚼ 形
const BT_PATH = 'M17.71,7.71L12,2h-1v7.59L6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 11,14.41V22h1l5.71,-5.71 -4.3,-4.29 4.3,-4.29z'

const BG = '#7A1212'   // ① 暗红圆底（够暗，保证红符号对比清晰）
const FG = '#E53935'   // ② 红色蓝牙符号
const DK = '#4A0A0A'   // ③ 斜杠：更深的暗红，斜穿符号切断（表断联）

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <clipPath id="circleClip"><circle cx="128" cy="128" r="120"/></clipPath>
  </defs>
  <circle cx="128" cy="128" r="120" fill="${BG}"/>
  <g clip-path="url(#circleClip)">
    <!-- 红色蓝牙符号（Material 官方 path，scale 8 居中） -->
    <g transform="translate(36.8, 32) scale(8)" fill="${FG}">
      <path d="${BT_PATH}"/>
    </g>
    <!-- 断联斜杠：深暗红细线，斜穿符号（左上→右下） -->
    <line x1="30" y1="30" x2="226" y2="226" stroke="${DK}" stroke-width="22" stroke-linecap="butt"/>
  </g>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng()
const out = path.join(__dirname, '..', 'src', 'common', 'icons', 'bluetooth_off.png')
fs.writeFileSync(out, png)
console.log('✅ bluetooth_off.png 简版定稿（' + png.length + 'B，128x128）：暗红底 #7A1212 + 红符号 #E53935 + 深暗红斜杠')

// 黑底三尺寸预览（256 放大 / 128 / 80 真机显示尺寸）
const BT = BT_PATH
function icon(s, uid) {
  return '<g transform="scale(' + (s / 256) + ')">'
    + '<defs><clipPath id="cc' + uid + '"><circle cx="128" cy="128" r="120"/></clipPath></defs>'
    + '<circle cx="128" cy="128" r="120" fill="#7A1212"/>'
    + '<g clip-path="url(#cc' + uid + ')">'
    + '<g transform="translate(36.8,32) scale(8)" fill="#E53935"><path d="' + BT + '"/></g>'
    + '<line x1="30" y1="30" x2="226" y2="226" stroke="#4A0A0A" stroke-width="22" stroke-linecap="butt"/>'
    + '</g></g>'
}
const outer = '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="256" viewBox="0 0 520 256">'
  + '<rect width="520" height="256" fill="#000"/>'
  + '<g transform="translate(0,0)">' + icon(256, 'a') + '</g>'
  + '<g transform="translate(266,64)">' + icon(128, 'b') + '</g>'
  + '<g transform="translate(420,88)">' + icon(80, 'c') + '</g></svg>'
fs.writeFileSync(path.join(__dirname, '..', '.bt_preview.png'), new Resvg(outer, { fitTo: { mode: 'width', value: 520 } }).render().asPng())
console.log('  （黑底三尺寸预览: velaPro/.bt_preview.png）')
