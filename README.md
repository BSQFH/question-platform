# 我爱我家

一个以手机端为主的 Next.js 刷题与模拟考试网站。

## 功能

- 自由组卷：考试/练习、全部题库/错题集、分类、难度、题型、题量和随机/顺序均可设置。
- 搜索题库：按题干、标题或选项搜索，支持多关键词匹配并直接练习搜索结果。
- 刷题练习：逐题提交、即时判定、正确答案和解析。
- 模拟考试：可设置时长，支持答题卡、前后跳题、未答提醒和超时自动交卷。
- 题型：支持单选、多选、判断、填空和简答；选择题支持 A-F 选项。
- 错题集：自动去重，支持搜索、分类筛选、标记已掌握和恢复复习。
- 学习记录：区分练习与考试，显示题数、正确率、错题数和用时。
- 本机优先：成绩、错题和掌握状态默认保存在当前浏览器中。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 从 GitHub 部署

本项目包含 Next.js Route Handlers，不适合直接发布到 GitHub Pages。推荐的部署方式：

1. 将项目文件推送到 GitHub 仓库。
2. 在 Vercel 新建项目并导入该仓库。
3. 保持框架预设为 `Next.js`，按需填写下方环境变量。
4. 点击部署；以后推送到 GitHub 时，Vercel 会自动重新部署。

## 数据模式

- 项目内置 3410 道题，其中 3397 道通过自动质检并可直接组卷。
- 题库由 16 道原内置题、2042 道“老题库”和 1352 道“地铁智学”题目组成。
- 13 道缺图、截断或答案明显异常的题目仍保存在生成数据中，但已隔离，不会进入正常随机组卷。
- 成绩和错题默认保存在当前浏览器的 `localStorage` 中，不会与其他用户混用；接近存储配额时会优先淘汰最旧记录并保留最新成绩。
- 配置 Supabase 后，题目接口会按 `id` 稳定分页读取完整 `questions` 表；读取失败或数据为空时自动使用内置题库。
- 远程题目可选提供 `category`、`difficulty` 和 `type` 字段；缺失时会使用默认值。
- 只有显式设置 `SUPABASE_SYNC_RECORDS=true` 时才会同步成绩。

填空题使用归一化文本判分；简答题在练习中展示参考答案并由学习者标记“已掌握/需要复习”，不会进入模拟考试池。详细题量和质检结果见 `QUESTION_BANK_IMPORT_REPORT.md`。

## 重新导入 Word 题库

生成数据位于 `app/data/generated/`，导入脚本位于 `scripts/import_docx_questions.py`。脚本依赖 `python-docx`，会校验各章节题量、答案和选项引用；具体命令见 `QUESTION_BANK_IMPORT_REPORT.md`。

## Supabase 可选配置

可选环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SYNC_RECORDS=false
SUPABASE_READ_SHARED_RECORDS=false
```

生产环境如需多用户云端成绩，应接入 Supabase Auth，并为 `records` 表配置基于 `user_id` 的 RLS 策略。

## 验证

```bash
npm test
npm run build
```

当前自动测试共 22 项，覆盖五种题型、题目搜索、3410 道内置题的规范化、Supabase 分页、错题和本机存储配额退避逻辑。
