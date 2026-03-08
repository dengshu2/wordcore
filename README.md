# WordCore

英语核心词汇练习应用 — 通过写例句真正掌握前 3000 高频词汇。

**核心学习闭环：** 看单词 → 自写例句 → 与参考例句对比 → 标注掌握 / 再练

## 技术栈

- [Vite 7](https://vitejs.dev/) + [React 19](https://react.dev/)
- [React Router 7](https://reactrouter.com/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/)
- [@tanstack/react-virtual](https://tanstack.com/virtual) — 词库列表虚拟化
- 数据存储：`localStorage`（无后端、无账号）

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm test         # 运行测试
npm run lint     # ESLint 检查
npm run build    # 构建生产包
```

## AI 句子校验

学习页的 `Self-check` 会调用 Gemini 做轻量句子反馈。开发前请先配置：

```bash
cp .env.example .env
# 编辑 .env，填入你的 GEMINI_API_KEY 和 VITE_GEMINI_API_KEY
```

- `GEMINI_API_KEY`：离线生成词库脚本使用
- `VITE_GEMINI_API_KEY`：前端运行时的句子校验使用

## 词库数据说明

`src/data/words.json` 包含 3000 个高频英语词汇，每个词条包含：
- `word` — 单词
- `pos` — 词性
- `definition` — 英文释义
- `example` — 参考例句

词库由 `scripts/generate-words.mjs` 脚本 + Gemini API 离线生成（一次性操作）。
如需重新生成，请先配置 `.env` 文件：

```bash
cp .env.example .env
# 编辑 .env，填入你的 GEMINI_API_KEY
node scripts/generate-words.mjs
```

## 文档

- [产品需求文档](./docs/PRD.md)
- [设计文档](./docs/plans/2026-03-07-wordcore-design.md)
- [实施计划](./docs/plans/2026-03-07-wordcore-implementation.md)
