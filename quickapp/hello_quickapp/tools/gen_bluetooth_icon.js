#!/usr/bin/env node
// gen_bluetooth_icon.js —— 「蓝牙未连接」图标（v1.16.52 第 5 版，主人定稿方向）
// 主人描述的结构：①【完整的】暗红色半透明圆底（不被切割）
//                ② 圆上有一个【红色蓝牙标识】
//                ③ 标识被一条斜向【留空】切开——缝里透出圆底暗红色（圆底完好，
//                   「留空」只作用在标识上，不是把整个圆切成两半）
// 用法: node tools/gen_bluetooth_icon.js
// 产出: src/common/icons/bluetooth_off.png（128x128）
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

// Material Design 官方 bluetooth 图标 path（24x24）——标准 ᚼ 形
const BT_PATH = 'M17.71,7.71L12,2h-1v7.59L6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 11,14.41V22h1l5.71,-5.71 -4.3,-4.29 4.3,-4.29z'

const BG = 'rgba(139,20,20,0.5)'   // 暗红半透明圆底（黑底上合成≈深暗红，主人：偏透明）
const FG = '#FF5252'               // 亮红蓝牙标识（暗底上清晰可辨）

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <clipPath id="circleClip"><circle cx="128" cy="128" r="120"/></clipPath>
    <!-- 斜缝遮罩：只挖【标识】——白=保留标识，黑斜线=标识上留空的断缝（透出圆底暗红） -->
    <mask id="slashCut">
      <rect x="0" y="0" width="256" height="256" fill="#FFFFFF"/>
      <line x1="26" y1="26" x2="230" y2="230" stroke="#000000" stroke-width="46" stroke-linecap="butt"/>
    </mask>
  </defs>
  <!-- ① 完整的暗红半透明圆底（无任何切割） -->
  <circle cx="128" cy="128" r="120" fill="${BG}"/>
  <g clip-path="url(#circleClip)">
    <!-- ②③ 红色蓝牙标识 + 斜向留空断缝（缝里 = 圆底的暗红） -->
    <g transform="translate(36.8, 32) scale(8)" fill="${FG}" mask="url(#slashCut)">
      <path d="${BT_PATH}"/>
    </g>
  </g>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng()
const out = path.join(__dirname, '..', 'src', 'common', 'icons', 'bluetooth_off.png')
fs.writeFileSync(out, png)
console.log('✅ bluetooth_off.png 第 5 版（' + png.length + 'B，128x128）：完整暗红半透圆底 + 亮红标识 + 标识上留空断缝')

// 黑底三尺寸预览（256 放大核对 / 128 / 80 真机显示尺寸）
const BT = BT_PATH
function icon(s) {
  return '<g transform="scale(' + (s / 256) + ')">'
    + '<defs><clipPath id="cc' + s + '"><circle cx="128" cy="128" r="120"/></clipPath>'
    + '<mask id="mc' + s + '"><rect width="256" height="256" fill="#fff"/>'
    + '<line x1="26" y1="26" x2="230" y2="230" stroke="#000" stroke-width="46"/></mask></defs>'
    + '<circle cx="128" cy="128" r="120" fill="rgba(139,20,20,0.5)"/>'
    + '<g clip-path="url(#cc' + s + ')"><g mask="url(#mc' + s + ')" transform="translate(36.8,32) scale(8)" fill="#FF5252"><path d="' + BT + '"/></g></g></g>'
}
const outer = '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="256" viewBox="0 0 520 256">'
  + '<rect width="520" height="256" fill="#000"/>'
  + '<g transform="translate(0,0)">' + icon(256) + '</g>'
  + '<g transform="translate(266,64)">' + icon(128) + '</g>'
  + '<g transform="translate(420,88)">' + icon(80) + '</g></svg>'
fs.writeFileSync(path.join(__dirname, '..', '.bt_preview.png'), new Resvg(outer, { fitTo: { mode: 'width', value: 520 } }).render().asPng())
console.log('  （黑底三尺寸预览: velaPro/.bt_preview.png）')
