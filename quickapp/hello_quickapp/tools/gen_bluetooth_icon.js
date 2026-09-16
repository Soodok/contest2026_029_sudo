// gen_bluetooth_off.js —— 重新绘制「蓝牙未连接」图标
// 风格对齐项目内其他线性图标（voice.png 等：64x64 透明底、居中线条、圆角端点）
// 图案：标准蓝牙符号（ᛒ 折线）+ 右上→左下斜杠（表示断连），灰色线条 + 红色斜杠
const fs = require('fs');
const { Resvg } = require('@resvg/resvg-js');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <!-- 蓝牙符号：ᛒ 折线（左下→右上→竖顶→竖底→右下→左上）-->
  <path d="M 21 43 L 43 21 L 32 10 L 32 54 L 43 43 L 21 21"
        stroke="#757575" stroke-width="3.5" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>
  <!-- 斜杠：未连接标记（从左上到右下贯穿，颜色与小米"关闭"态一致）-->
  <line x1="12" y1="12" x2="52" y2="52"
        stroke="#FF4444" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: 'width', value: 64 } }).render().asPng();
fs.writeFileSync('src/common/icons/bluetooth_off.png', png);
console.log('✓ bluetooth_off.png 已重新生成（' + png.length + 'B，64x64）');

// 同时生成"已连接"版本（纯蓝牙符号，无斜杠，颜色亮一些）备用
const svgOn = svg.replace('#9E9E9E', '#FFFFFF').replace(
  /<line[^/]*\/>/, ''
);
const pngOn = new Resvg(svgOn, { fitTo: { mode: 'width', value: 64 } }).render().asPng();
fs.writeFileSync('src/common/icons/bluetooth.png', pngOn);
console.log('✓ bluetooth.png 已重新生成（' + pngOn.length + 'B）');
