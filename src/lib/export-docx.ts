import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import type { EmailObject } from "./email-prompts";

export async function generateDocx(
  sequenceName: string,
  brandName: string,
  emails: EmailObject[],
): Promise<Blob> {
  const divider = new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "c9a84c" },
    },
    spacing: { after: 300, before: 300 },
  });

  const children: Paragraph[] = [
    // Title
    new Paragraph({
      children: [
        new TextRun({
          text: `${brandName}`,
          bold: true,
          size: 36,
          color: "1a2e1a",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: sequenceName,
          size: 28,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    divider,
  ];

  for (const [i, email] of emails.entries()) {
    // Email heading
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Email ${i + 1} — Day ${email.day}：${email.theme}`,
            bold: true,
            size: 26,
            color: "1a2e1a",
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
    );

    // Send timing
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "發送時機：", bold: true, size: 20, color: "c9a84c" }),
          new TextRun({ text: email.sendTiming, size: 20 }),
        ],
        spacing: { after: 150 },
      }),
    );

    // Subject
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "主旨：", bold: true, size: 22 }),
          new TextRun({ text: email.subject, size: 22 }),
        ],
        spacing: { after: 80 },
      }),
    );

    // Alt subject
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "備用主旨（A/B）：", bold: true, size: 20, color: "888888" }),
          new TextRun({ text: email.subjectAlt, size: 20, color: "888888" }),
        ],
        spacing: { after: 80 },
      }),
    );

    // Preview text
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "預覽文字：", bold: true, size: 20 }),
          new TextRun({ text: email.previewText, size: 20 }),
        ],
        spacing: { after: 200 },
      }),
    );

    // Body label
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "正文：", bold: true, size: 20, color: "c9a84c" }),
        ],
        spacing: { after: 100 },
      }),
    );

    // Body content - split by paragraphs
    const paragraphs = email.body.split("\n\n").filter((p) => p.trim());
    for (const p of paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p.trim(), size: 20 })],
          spacing: { after: 120 },
        }),
      );
    }

    // CTA
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "CTA 按鈕：", bold: true, size: 20 }),
          new TextRun({ text: `[ ${email.cta} ]`, bold: true, size: 20, color: "c9a84c" }),
        ],
        spacing: { before: 200, after: 100 },
      }),
    );

    // Divider between emails
    if (i < emails.length - 1) {
      children.push(divider);
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
