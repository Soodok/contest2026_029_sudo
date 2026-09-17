#!/usr/bin/env node
// gen_bluetooth_icon.js —— 「蓝牙未连接」图标（v1.16.54 第 7 版，逐像素对照实拍）
// 实拍解构（放大极限核对）：
//   ① 圆底 = 亮红色实心（#C62828 附近，非暗红、非透明）
//   ② 符号 = 亮橙红的两截箭头形态——由【深暗红轮廓线】从红底上"刻"出形状
//   ③ 斜杠 = 深暗红色粗线（#7F1D1D，比圆底暗），斜穿符号中部把符号切成两段
//      —— 斜杠是"更暗的线"，不是透明缝、也不是底色挖空（前几版方向性错误再次修正）
// 用法: node tools/gen_bluetooth_icon.js
// 产出: src/common/icons/bluetooth_off.png（128x128）
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

// Material Design 官方 bluetooth 图标 path（24x24）——标准 ᚼ 形
const BT_PATH = 'M17.71,7.71L12,2h-1v7.59L6.41,5 5,6.41 10.59,12 5,17.59 6.41,19 11,14.41V22h1l5.71,-5.71 -4.3,-4.29 4.3,-4.29z'

const BG = '#C62828'   // ① 亮红圆底
const FG = '#FF6B60'   // ② 亮橙红符号芯（比底亮，照片观感）
const DK = '#7F1D1D'   // ②③ 深暗红：符号描边 + 断联斜杠

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <clipPath id="circleClip"><circle cx="128" cy="128" r="120"/></clipPath>
    <clipPath id="symbolClip"><path d="${BT_PATH}" transform="translate(34,29) scale(8.3)"/></clipPath>
  </defs>
  <circle cx="128" cy="128" r="120" fill="${BG}"/>
  <g clip-path="url(#circleClip)">
    <!-- 符号描边：深暗红大一圈的符号垫底（形成"深色轮廓刻出符号"效果） -->
    <g transform="translate(34, 29) scale(8.3)" fill="${DK}">
      <path d="${BT_PATH}"/>
    </g>
    <!-- 符号芯：亮橙红（比底亮） -->
    <g transform="translate(36.8, 32) scale(8)" fill="${FG}">
      <path d="${BT_PATH}"/>
    </g>
    <!-- 断联斜杠：深暗红粗线（比圆底暗）斜穿符号中部，把符号切成两段 -->
    <g clip-path="url(#symbolClip)">
      <line x1="30" y1="30" x2="226" y2="226" stroke="${DK}" stroke-width="26" stroke-linecap="butt"/>
    </g>
  </g>
</svg>`

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } }).render().asPng()
const out = path.join(__dirname, '..', 'src', 'common', 'icons', 'bluetooth_off.png')
fs.writeFileSync(out, png)
console.log('✅ bluetooth_off.png 第 7 版（' + png.length + 'B，128x128）：亮红底 + 亮橙红符号(深暗红描边) + 深暗红粗斜杠')

// 黑底三尺寸预览（256 放大核对 / 128 / 80 真机显示尺寸）
const BT = BT_PATH
function icon(s, uid) {
  return '<g transform="scale(' + (s / 256) + ')">'
    + '<defs><clipPath id="cc' + uid + '"><circle cx="128" cy="128" r="120"/></clipPath>'
    + '<clipPath id="sc' + uid + '"><path transform="translate(34,29) scale(8.3)" d="' + BT + '"/></clipPath></defs>'
    + '<circle cx="128" cy="128" r="120" fill="#C62828"/>'
    + '<g clip-path="url(#cc' + uid + ')">'
    + '<g transform="translate(34,29) scale(8.3)" fill="#7F1D1D"><path d="' + BT + '"/></g>'
    + '<g transform="translate(36.8,32) scale(8)" fill="#FF6B60"><path d="' + BT + '"/></g>'
    + '<g clip-path="url(#sc' + uid + ')"><line x1="30" y1="30" x2="226" y2="226" stroke="#7F1D1D" stroke-width="26" stroke-linecap="butt"/></g>'
    + '</g></g>'
}
const outer = '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="256" viewBox="0 0 520 256">'
  + '<rect width="520" height="256" fill="#000"/>'
  + '<g transform="translate(0,0)">' + icon(256, 'a') + '</g>'
  + '<g transform="translate(266,64)">' + icon(128, 'b') + '</g>'
  + '<g transform="translate(420,88)">' + icon(80, 'c') + '</g></svg>'
fs.writeFileSync(path.join(__dirname, '..', '.bt_preview.png'), new Resvg(outer, { fitTo: { mode: 'width', value: 520 } }).render().asPng())
console.log('  （黑底三尺寸预览: velaPro/.bt_preview.png）')
