#!/usr/bin/env node
// gen_bluetooth_icon.js —— 「蓝牙未连接」图标（v1.16.47 按主人手环实拍照片仿制）
// 官方样式（照片）：红色圆底 + 白色标准蓝牙符号（Material 官方 path）
//   + 同底色斜杠从左上到右下【切断符号】。
// 用法: node tools/gen_bluetooth_icon.js
// 产出: src/common/icons/bluetooth_off.png（256x256）
// 注：连接态图标（bluetooth.png）无代码引用，v1.16.47 已删除并不再生成
//（语音面板连接态显示波形动画 voice_wave_*，不用蓝牙图标）。
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

// Material Design 官方 bluetooth 图标 path（24x24 viewBox）——标准 ᚼ 形，被全平台采用
const BT_PATH = 'M17.71,7.71L12,2h-1v7.59L6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 11,14.41V22h1l5.71,-5.71 -4.3,-4.29 4.3,-4.29z'

// 红底圆 + 白符号（缩放到 256 画布居中）+ 红斜杠切断。斜杠与底同色 → 符号被切成两段 = 官方"断开"观感
const BG = '#E53935'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <clipPath id="circleClip"><circle cx="128" cy="128" r="120"/></clipPath>
  </defs>
  <circle cx="128" cy="128" r="120" fill="${BG}"/>
  <g clip-path="url(#circleClip)">
    <!-- 白色蓝牙符号：Material 官方 24x24 path，scale 8 居中 -->
    <g transform="translate(36.8, 32) scale(8)" fill="#FFFFFF">
      <path d="${BT_PATH}"/>
    </g>
    <!-- 同底色斜杠（左上→右下）：切断符号 -->
    <line x1="34" y1="34" x2="222" y2="222" stroke="${BG}" stroke-width="26" stroke-linecap="round"/>
  </g>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng()
const out = path.join(__dirname, '..', 'src', 'common', 'icons', 'bluetooth_off.png')
fs.writeFileSync(out, png)
console.log('✅ bluetooth_off.png 已重新生成（' + png.length + 'B，256x256，官方样式：红圆底+白符号+斜杠切断）')

// 预览条：与手环实际显示尺寸（80px）对照
fs.writeFileSync(path.join(__dirname, '..', '..', 'bt_preview.png'), png)
