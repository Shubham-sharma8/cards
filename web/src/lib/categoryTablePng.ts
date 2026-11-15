import type { CategoryStudyTable } from "./categoryStudies";
import { cardLocalImageUrl } from "./format";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || "—").split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["—"];
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(w).width > maxWidth) {
        let part = "";
        for (const ch of w) {
          if (ctx.measureText(part + ch).width > maxWidth && part) {
            lines.push(part);
            part = ch;
          } else {
            part += ch;
          }
        }
        current = part;
      } else {
        current = w;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImageSafely(src: string | null): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 2200);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

export async function downloadCategoryStudyAsPng(table: CategoryStudyTable): Promise<void> {
  const scale = 2;
  const width = 1440;
  const outerPad = 36;
  const tableWidth = width - outerPad * 2;
  const thumbW = 60;
  const thumbH = 38;
  const colWidths = [152, 310, 132, 250, 210, tableWidth - (152 + 310 + 132 + 250 + 210)];
  const cellPadX = 14;
  const cellPadY = 12;
  const lineHeight = 19;

  // Preload miniature card artwork in parallel
  const loadedThumbs = await Promise.all(
    table.rows.map((r) => loadImageSafely(cardLocalImageUrl(r.localImagePath)))
  );

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) return;

  const fontStack =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  mctx.font = `400 14px ${fontStack}`;
  const subtitleLines = wrapText(mctx, table.subtitle, tableWidth - 280);

  const headerBandH = 92 + Math.max(0, subtitleLines.length - 1) * 20;
  const tableHeadH = 48;

  interface MeasuredRow {
    bankLines: string[];
    cardLines: string[];
    feeLines: string[];
    colLines: string[][];
    height: number;
    thumb: HTMLImageElement | null;
  }

  const measuredRows: MeasuredRow[] = table.rows.map((r, idx) => {
    mctx.font = `600 13px ${fontStack}`;
    const bankLines = wrapText(mctx, r.bank, colWidths[0] - cellPadX * 2);

    const cardTextAvail = colWidths[1] - cellPadX * 2 - (loadedThumbs[idx] ? thumbW + 10 : 0);
    mctx.font = `600 13.5px ${fontStack}`;
    const cardLines = wrapText(mctx, r.cardName, cardTextAvail);

    mctx.font = `600 13px ${fontStack}`;
    const feeLabel = r.rating ? `${r.annualFee} (${r.rating.toFixed(1)}★)` : r.annualFee;
    const feeLines = wrapText(mctx, feeLabel, colWidths[2] - cellPadX * 2);

    mctx.font = `400 13px ${fontStack}`;
    const colLines = [
      wrapText(mctx, r.cells[0] || "—", colWidths[3] - cellPadX * 2),
      wrapText(mctx, r.cells[1] || "—", colWidths[4] - cellPadX * 2),
      wrapText(mctx, r.cells[2] || "—", colWidths[5] - cellPadX * 2),
    ];

    const maxLines = Math.max(
      bankLines.length,
      cardLines.length,
      feeLines.length,
      ...colLines.map((cl) => cl.length)
    );
    const minCardRowH = loadedThumbs[idx] ? thumbH + cellPadY * 2 : 52;
    const height = Math.max(minCardRowH, cellPadY * 2 + maxLines * lineHeight);
    return { bankLines, cardLines, feeLines, colLines, height, thumb: loadedThumbs[idx] };
  });

  const rowsTotalH = measuredRows.reduce((s, r) => s + r.height, 0);
  const footerH = 56;
  const totalHeight = outerPad + headerBandH + 16 + tableHeadH + rowsTotalH + footerH + outerPad;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  // Canvas Background
  ctx.fillStyle = "#FAF9F6";
  ctx.fillRect(0, 0, width, totalHeight);

  // Top Header Card
  let curY = outerPad;
  drawRoundedRect(ctx, outerPad, curY, tableWidth, headerBandH, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E2E3DD";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Brand badge top right
  const badgeW = 236;
  const badgeH = 36;
  const badgeX = outerPad + tableWidth - badgeW - 22;
  const badgeY = curY + 20;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  ctx.fillStyle = "#0F5C4D";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 13px ${fontStack}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Cards by cogify · 2026 Guide", badgeX + badgeW / 2, badgeY + badgeH / 2);

  // Title & Subtitle
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#1A1D21";
  ctx.font = `700 24px ${fontStack}`;
  ctx.fillText(table.title, outerPad + 24, curY + 20);

  ctx.fillStyle = "#4B525C";
  ctx.font = `400 14px ${fontStack}`;
  subtitleLines.forEach((line, idx) => {
    ctx.fillText(line, outerPad + 24, curY + 54 + idx * 20);
  });

  curY += headerBandH + 16;

  // Table Header Bar
  const tableTopY = curY;
  const tableFullH = tableHeadH + rowsTotalH;

  drawRoundedRect(ctx, outerPad, tableTopY, tableWidth, tableHeadH, 10);
  ctx.fillStyle = "#4A515E";
  ctx.fill();
  ctx.fillRect(outerPad, tableTopY + tableHeadH - 10, tableWidth, 10);

  // Spruce first-two-col accent strip on header
  drawRoundedRect(ctx, outerPad, tableTopY, colWidths[0], tableHeadH, 10);
  ctx.fillStyle = "#0F5C4D";
  ctx.fill();
  ctx.fillRect(outerPad + 10, tableTopY, colWidths[0] - 10, tableHeadH);
  ctx.fillRect(outerPad, tableTopY + tableHeadH - 10, colWidths[0], 10);

  const headers = [
    "Provider",
    "Credit Card",
    "Annual Fee",
    table.columns[0] || "Primary Return",
    table.columns[1] || "Secondary Edge",
    table.columns[2] || "Caps, Waiver & Notes",
  ];

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 13px ${fontStack}`;
  ctx.textBaseline = "middle";
  let xPos = outerPad;
  headers.forEach((h, i) => {
    ctx.fillText(h, xPos + cellPadX, tableTopY + tableHeadH / 2);
    xPos += colWidths[i];
  });

  curY += tableHeadH;

  measuredRows.forEach((mr, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    // Left provider tint column
    ctx.fillStyle = isAlt ? "#E2ECE8" : "#EDF3F0";
    ctx.fillRect(outerPad, curY, colWidths[0], mr.height);

    // Remaining columns background
    ctx.fillStyle = isAlt ? "#F6F5F8" : "#FFFFFF";
    ctx.fillRect(outerPad + colWidths[0], curY, tableWidth - colWidths[0], mr.height);

    // Row divider
    ctx.strokeStyle = "#DEDEE4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(outerPad, curY + mr.height);
    ctx.lineTo(outerPad + tableWidth, curY + mr.height);
    ctx.stroke();

    // Vertical column dividers
    let divX = outerPad;
    for (let i = 0; i < colWidths.length - 1; i++) {
      divX += colWidths[i];
      ctx.beginPath();
      ctx.moveTo(divX, curY);
      ctx.lineTo(divX, curY + mr.height);
      ctx.stroke();
    }

    ctx.textBaseline = "top";
    let cx = outerPad;

    // Col 0: Provider
    ctx.fillStyle = "#1A1D21";
    ctx.font = `600 13px ${fontStack}`;
    mr.bankLines.forEach((ln, li) => {
      ctx.fillText(ln, cx + cellPadX, curY + cellPadY + li * lineHeight);
    });
    cx += colWidths[0];

    // Col 1: Thumbnail + Card Name
    let textStartX = cx + cellPadX;
    if (mr.thumb) {
      const tx = cx + cellPadX;
      const ty = curY + Math.max(cellPadY, (mr.height - thumbH) / 2);
      ctx.save();
      drawRoundedRect(ctx, tx, ty, thumbW, thumbH, 5);
      ctx.clip();
      ctx.drawImage(mr.thumb, tx, ty, thumbW, thumbH);
      ctx.restore();
      ctx.strokeStyle = "#D4D7D1";
      ctx.lineWidth = 0.8;
      drawRoundedRect(ctx, tx, ty, thumbW, thumbH, 5);
      ctx.stroke();
      textStartX = tx + thumbW + 10;
    }
    ctx.fillStyle = "#0F5C4D";
    ctx.font = `600 13.5px ${fontStack}`;
    mr.cardLines.forEach((ln, li) => {
      ctx.fillText(ln, textStartX, curY + cellPadY + li * lineHeight);
    });
    cx += colWidths[1];

    // Col 2: Annual Fee & Rating
    ctx.fillStyle = "#1A1D21";
    ctx.font = `600 13px ${fontStack}`;
    mr.feeLines.forEach((ln, li) => {
      ctx.fillText(ln, cx + cellPadX, curY + cellPadY + li * lineHeight);
    });
    cx += colWidths[2];

    // Cols 3..5: Dynamic metrics
    ctx.fillStyle = "#2E333B";
    ctx.font = `400 13px ${fontStack}`;
    mr.colLines.forEach((cl, cIdx) => {
      cl.forEach((ln, li) => {
        ctx.fillText(ln, cx + cellPadX, curY + cellPadY + li * lineHeight);
      });
      cx += colWidths[3 + cIdx];
    });

    curY += mr.height;
  });

  // Outer table border
  ctx.strokeStyle = "#D0D2DA";
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, outerPad, tableTopY, tableWidth, tableFullH, 10);
  ctx.stroke();

  // Footer
  const dateStr = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  ctx.fillStyle = "#717882";
  ctx.font = `400 12.5px ${fontStack}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(
    `Verified MITC & Post-Cap Data · Top ${table.rows.length} Cards · ${dateStr}`,
    outerPad + 4,
    curY + footerH / 2
  );
  ctx.textAlign = "right";
  ctx.fillStyle = "#0F5C4D";
  ctx.font = `600 12.5px ${fontStack}`;
  ctx.fillText("card.cogify.me · Objective Net-Return Ledger", outerPad + tableWidth - 4, curY + footerH / 2);

  const fileName = `cardledger-${table.categoryId}-study-2026.png`;
  const triggerDownload = (url: string, revoke: boolean) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (revoke) {
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  };

  if (canvas.toBlob) {
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          triggerDownload(url, true);
        } else {
          triggerDownload(canvas.toDataURL("image/png"), false);
        }
        resolve();
      }, "image/png");
    });
  } else {
    triggerDownload(canvas.toDataURL("image/png"), false);
  }
}
