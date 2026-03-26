const fs = require('fs');
const path = require('path');

const files = [
  'gzhQualityPrompt.ts',
  'xhsQualityPrompt.ts',
  'douyinQualityPrompt.ts',
  'xhsContentPrompt.ts',
  'douyinContentPrompt.ts',
  'gzhContentPrompt.ts'
];

files.forEach(f => {
  const filePath = path.join(__dirname, f);
  let content = fs.readFileSync(filePath, 'utf8');
  // 把 ``` 替换为 【代码块】 标记
  const fixed = content.replace(/```/g, '【代码块】');
  if (content !== fixed) {
    fs.writeFileSync(filePath, fixed);
    console.log('Fixed:', f);
  }
});
