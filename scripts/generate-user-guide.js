const fs = require("fs");
const path = require("path");

const { HELP_SECTIONS, USER_GUIDE_META } = require("../miniprogram/packages/tools/help/helpContent");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "docs/USER_GUIDE.md");
const supportedBlocks = new Set(["paragraph", "bullets", "steps", "table", "image", "flow", "code", "questions"]);

function assertText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} 不能为空`);
}

function validateHelpSections() {
  const ids = new Set();
  HELP_SECTIONS.forEach((section, sectionIndex) => {
    const label = `HELP_SECTIONS[${sectionIndex}]`;
    ["id", "navTitle", "title", "subtitle", "intro", "entry"].forEach((field) => assertText(section[field], `${label}.${field}`));
    if (ids.has(section.id)) throw new Error(`帮助章节 id 重复：${section.id}`);
    ids.add(section.id);
    if (!Array.isArray(section.flow) || section.flow.length < 2) throw new Error(`${label}.flow 至少需要两个节点`);
    if (!Array.isArray(section.steps) || !section.steps.length) throw new Error(`${label}.steps 不能为空`);
    if (!Array.isArray(section.tips)) throw new Error(`${label}.tips 必须是数组`);
    if (section.url && !section.actionLabel) throw new Error(`${label}.url 缺少 actionLabel`);

    const guideSections = section.guide && section.guide.sections;
    if (!Array.isArray(guideSections) || !guideSections.length) throw new Error(`${label}.guide.sections 不能为空`);
    guideSections.forEach((guideSection, guideIndex) => {
      assertText(guideSection.title, `${label}.guide.sections[${guideIndex}].title`);
      if (!Array.isArray(guideSection.blocks) || !guideSection.blocks.length) {
        throw new Error(`${label}.guide.sections[${guideIndex}].blocks 不能为空`);
      }
      guideSection.blocks.forEach((block, blockIndex) => {
        if (!supportedBlocks.has(block.type)) {
          throw new Error(`${label}.guide.sections[${guideIndex}].blocks[${blockIndex}] 类型不受支持：${block.type}`);
        }
        if (block.type === "image") {
          const imagePath = path.join(root, "docs", block.src || "");
          if (!block.src || !fs.existsSync(imagePath)) throw new Error(`手册截图不存在：${block.src || "(empty)"}`);
        }
      });
    });
  });
}

function tableCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderTable(block) {
  const header = `| ${block.headers.map(tableCell).join(" | ")} |`;
  const divider = `| ${block.headers.map(() => "---").join(" | ")} |`;
  const rows = block.rows.map((row) => `| ${row.map(tableCell).join(" | ")} |`);
  return [header, divider, ...rows].join("\n");
}

function renderImage(block) {
  const width = block.width || 360;
  return [
    "<p align=\"center\">",
    `  <img src=\"${block.src}\" width=\"${width}\" alt=\"${block.alt}\">`,
    "</p>",
    "",
    `<p align=\"center\"><em>${block.caption}</em></p>`
  ].join("\n");
}

function renderFlow(block) {
  const lines = ["```mermaid", `flowchart ${block.direction || "LR"}`];
  block.nodes.forEach((node) => lines.push(`    ${node.id}[${JSON.stringify(node.label)}]`));
  block.edges.forEach((edge) => {
    if (Array.isArray(edge)) {
      lines.push(`    ${edge[0]} --> ${edge[1]}`);
      return;
    }
    lines.push(`    ${edge.from} -->${edge.label ? `|${edge.label}|` : ""} ${edge.to}`);
  });
  lines.push("```");
  return lines.join("\n");
}

function renderBlock(block) {
  switch (block.type) {
    case "paragraph":
      return block.text;
    case "bullets":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "steps":
      return block.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case "table":
      return renderTable(block);
    case "image":
      return renderImage(block);
    case "flow":
      return renderFlow(block);
    case "code":
      return `\`\`\`${block.language || "text"}\n${block.text}\n\`\`\``;
    case "questions":
      return block.items.map((item) => `#### ${item.question}\n\n${item.answer}`).join("\n\n");
    default:
      throw new Error(`无法渲染手册块：${block.type}`);
  }
}

function renderCoreContent(section) {
  const lines = [
    section.subtitle,
    "",
    section.intro,
    "",
    `**功能入口：** ${section.entry}`
  ];
  if (section.url) {
    lines.push("", `**页面直达：** ${section.actionLabel}（\`${section.url}\`${section.tab ? "，底部导航页" : ""}）`);
  }
  lines.push("", "### 核心路径", "", section.flow.map((item) => `\`${item.label}\``).join(" → "), "");

  if (section.id === "faq") {
    lines.push("### 高频问题", "");
    section.steps.forEach((step) => lines.push(`#### ${step.title}`, "", step.text, ""));
  } else {
    lines.push("### 核心步骤", "");
    section.steps.forEach((step, index) => lines.push(`${index + 1}. **${step.title}：** ${step.text}`));
    lines.push("");
  }

  lines.push("### 使用提醒", "", ...section.tips.map((tip) => `- ${tip}`));
  return lines.join("\n");
}

function renderSection(section, index) {
  const lines = [
    `<a id=\"section-${section.id}\"></a>`,
    `## ${index + 1}. ${section.title}`,
    "",
    renderCoreContent(section)
  ];
  section.guide.sections.forEach((guideSection) => {
    lines.push("", `### ${guideSection.title}`, "");
    guideSection.blocks.forEach((block) => lines.push(renderBlock(block), ""));
    if (!lines[lines.length - 1]) lines.pop();
  });
  return lines.join("\n");
}

function renderUserGuide() {
  validateHelpSections();
  const lines = [
    `# ${USER_GUIDE_META.title}`,
    "",
    "<!-- 此文件由 scripts/generate-user-guide.js 根据 miniprogram/packages/tools/help/helpContent.js 生成，请勿手工编辑。 -->",
    "",
    `> 适用版本：${USER_GUIDE_META.version}<br>`,
    `> 更新日期：${USER_GUIDE_META.updatedAt}<br>`,
    ...USER_GUIDE_META.notes.map((note) => `> ${note}`),
    "",
    ...USER_GUIDE_META.introduction.flatMap((paragraph) => [paragraph, ""]),
    "## 目录",
    "",
    ...HELP_SECTIONS.map((section, index) => `${index + 1}. [${section.title}](#section-${section.id})`),
    "",
    HELP_SECTIONS.map(renderSection).join("\n\n"),
    "",
    "---",
    "",
    USER_GUIDE_META.footer,
    ""
  ];
  return lines.join("\n");
}

function generateUserGuide() {
  const output = renderUserGuide();
  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`generated ${path.relative(root, outputPath)} from miniprogram/packages/tools/help/helpContent.js`);
}

if (require.main === module) generateUserGuide();

module.exports = { generateUserGuide, outputPath, renderUserGuide, validateHelpSections };
