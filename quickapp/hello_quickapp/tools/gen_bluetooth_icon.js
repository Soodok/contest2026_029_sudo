#!/usr/bin/env node
// gen_bluetooth_icon.js —— 「蓝牙未连接」图标（v1.16.49 按主人描述重做）
// 主人描述（以此为准）：暗红色圆底 + 红色蓝牙标识 + 断联斜杠为【留空设计】
//   —— 斜杠不是画上去的线条，而是符号被斜向【挖掉一条缝】（缝里透出暗红底色）。
// 实现：SVG mask 挖缝（白底遮罩 + 黑色斜线 = 从符号中减去斜条）。
// 用法: node tools/gen_bluetooth_icon.js
// 产出: src/common/icons/bluetooth_off.png（128x128）
// 注：连接态图标（bluetooth.png）无代码引用，v1.16.47 已删除并不再生成
//（语音面板连接态显示波形动画 voice_wave_*，不用蓝牙图标）。
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

// Material Design 官方 bluetooth 图标 path（24x24 viewBox）——标准 ᚼ 形，被全平台采用
const BT_PATH = 'M17.71,7.71L12,2h-1v7.59L6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 11,14.41V22h1l5.71,-5.71 -4.3,-4.29 4.3,-4.29z'

const BG = '#8B1A1A'      // 暗红圆底
const FG = '#E53935'      // 红色蓝牙符号（比底亮一档，暗红上清晰可辨）

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <clipPath id="circleClip"><circle cx="128" cy="128" r="120"/></clipPath>
    <!-- 留空断缝遮罩：白=保留，黑斜线=从符号中挖去（缝里透出暗红底，非线条绘制） -->
    <mask id="slashCut">
      <rect x="0" y="0" width="256" height="256" fill="#FFFFFF"/>
      <line x1="20" y1="20" x2="236" y2="236" stroke="#000000" stroke-width="24" stroke-linecap="butt"/>
    </mask>
  </defs>
  <circle cx="128" cy="128" r="120" fill="${BG}"/>
  <g clip-path="url(#circleClip)">
    <!-- 红色蓝牙符号（Material 官方 24x24 path，scale 8 居中）＋斜向留空断缝 -->
    <g transform="translate(36.8, 32) scale(8)" fill="${FG}" mask="url(#slashCut)">
      <path d="${BT_PATH}"/>
    </g>
  </g>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng()
const out = path.join(__dirname, '..', 'src', 'common', 'icons', 'bluetooth_off.png')
fs.writeFileSync(out, png)
console.log('✅ bluetooth_off.png 已重做（' + png.length + 'B，128x128）：暗红底 #8B1A1A + 红符号 #E53935 + 斜杠留空断缝')

// 预览（放大版，供人工核对；渲染后删除）
const P = require('@resvg/resvg-js')
const big = new P.Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng()
fs.writeFileSync(path.join(__dirname, '..', '.bt_preview.png'), big)
console.log('  （预览: velaPro/.bt_preview.png）')
