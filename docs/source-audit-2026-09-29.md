# 官方来源与本地交付核验

本轮为本地修改，用户要求账号恢复前先完成内容。没有发布或更换项目。

## 题库

来源入口：https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test

阅读原题与答案：https://ielts.org/cdn/Sample-tests/ielts-academic-reading-sample-tasks-2023.pdf

新增条目只保存索引、官方答案和原创中文提示；原文继续由 IELTS.org PDF 提供，不复制完整出版物。共 22 组（听力 5、阅读 12、写作 5）。本轮增加 7 组阅读、31 道客观题。

| 条目 | 原题起始页 | 答案页 | 题数 |
| --- | --- | --- | --- |
| r-aging | 9 | 11 | 3 |
| r-science | 19 | 22 | 3 |
| r-curie-notes | 30 | 33 | 6 |
| r-birds | 34 | 37 | 5 |
| r-language | 38 | 40 | 4 |
| r-plain-english | 41 | 43 | 5 |
| r-greenhouse | 44 | 46 | 5 |

听力原文页按官方样题包目录核对：l-choice 9、l-sentence 15、l-match 19、l-match2 23、l-map 27。新阅读题中可选冠词、替代答案按官方答案页展开，不改变既有题目 ID 或旧记录。

## 核验结果

- `node scripts/verify.mjs`：12 项测试、格式、类型、lint、治理、两个目标构建通过。
- `node tests/api.mjs http://localhost:5173`：鉴权、来源、保存读取、重复请求、并发冲突、计分、提交锁定和单词复习通过。
- 官方资产可达性：直接 Node fetch 因本机代理路径失败；使用 Node 的 `--use-env-proxy` 后，3 份官方 PDF 和 5 份 MP3 的 HEAD 请求全部返回 HTTP 200。可达性不是离线保证，也不代表逐段听过录音。
- 浏览器：关键词与题型组合搜索、切换科目重置筛选、听力原文页链接、无错题空状态通过；390px 手机视口无横向溢出。

## 范围与限制

数据模型、账号权限及保存协议不变，无数据库迁移。外部 PDF 的嵌入表现取决于浏览器，保留新窗口打开入口。题库为官方样题专项，不是完整真题套卷。写作自查为提示，不生成分数。购买书目的内页和音频尚未提供，未宣称导入。新界面仍未上线。
