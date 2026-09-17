#!/usr/bin/env node
// gen_bluetooth_icon.js —— 「蓝牙未连接」图标（v1.16.55 终版，主人第 8 轮指示）
// 主人原话：「不需要什么斜杠了，能显示一个正常红色蓝牙，加一个透明红色背景就行了」
//   = ① 透明红色背景（半透明红圆底）  ② 正常红色蓝牙符号  ③ 无斜杠
// 官方图标拿到后直接覆盖 src/common/icons/bluetooth_off.png 即可（无代码改动）。
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

// Material Design 官方 bluetooth 图标 path（24x24）——正常标准 ᚼ 形
const BT_PATH = 'M17.71,7.71L12,2h-1v7.59L6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 11,14.41V22h1l5.71,-5.71 -4.3,-4.29 4.3,-4.29z'

const BG = 'rgba(229,57,53,0.35)'   // 透明红色背景（半透明红圆底，黑底上合成暗红）
const FG = '#E53935'                // 正常红色蓝牙符号

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <circle cx="128" cy="128" r="120" fill="${BG}"/>
  <g transform="translate(36.8, 32) scale(8)" fill="${FG}">
    <path d="${BT_PATH}"/>
  </g>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng()
const out = path.join(__dirname, '..', 'src', 'common', 'icons', 'bluetooth_off.png')
fs.writeFileSync(out, png)
console.log('✅ bluetooth_off.png 终版（' + png.length + 'B，128x128）：透明红底 rgba(229,57,53,0.35) + 正常红蓝牙符号（无斜杠）')

// 黑底三尺寸预览（256 放大 / 128 / 80 真机显示尺寸）
const BT = BT_PATH
function icon(s, uid) {
  return '<g transform="scale(' + (s / 256) + ')">'
    + '<circle cx="128" cy="128" r="120" fill="rgba(229,57,53,0.35)"/>'
    + '<g transform="translate(36.8,32) scale(8)" fill="#E53935"><path d="' + BT + '"/></g>'
    + '</g>'
}
const outer = '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="256" viewBox="0 0 520 256">'
  + '<rect width="520" height="256" fill="#000"/>'
  + '<g transform="translate(0,0)">' + icon(256, 'a') + '</g>'
  + '<g transform="translate(266,64)">' + icon(128, 'b') + '</g>'
  + '<g transform="translate(420,88)">' + icon(80, 'c') + '</g></svg>'
fs.writeFileSync(path.join(__dirname, '..', '.bt_preview.png'), new Resvg(outer, { fitTo: { mode: 'width', value: 520 } }).render().asPng())
console.log('  （黑底三尺寸预览: velaPro/.bt_preview.png）')
