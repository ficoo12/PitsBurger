// The fonts come in as data: URLs, so this module (and with it jsPDF, which
// is imported on demand below) is only loaded when the owner exports.
//
// The TTFs are Inter cut down to Latin, Latin-1 and Latin Extended-A
// (~26 kB each instead of ~410 kB); other letters come out blank. Made with
// fonttools from the full Inter 4 TTFs:
//   pyftsubset Inter-Regular.ttf --output-file=Inter-Regular.ttf \
//     --unicodes="U+0000-00FF,U+0100-017F,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
//     --layout-features='' --no-hinting --name-IDs='*' --notdef-outline
// (the same for Inter-Bold.ttf).
import boldUrl from "../../../assets/fonts/Inter-Bold.ttf?inline";
import regularUrl from "../../../assets/fonts/Inter-Regular.ttf?inline";
import type { jsPDF } from "jspdf";
import { paletteToken } from "../../../lib/palette";
import { weekLabel } from "../week";
import type { PdfCell, PdfPage } from "./schedulePdfModel";

const FONT = "Inter";
/** Page margin in mm; A4 landscape is 297 × 210. */
const MARGIN = 10;
const PAGE_WIDTH = 297;
/** The band behind the restaurant's name: from MARGIN down, in mm. */
const TITLE_HEIGHT = 10;
/** The name column's width in mm; the seven days share the rest equally. */
const NAME_WIDTH = 46;
const DAY_WIDTH = (PAGE_WIDTH - 2 * MARGIN - NAME_WIDTH) / 7;

/** A design token from variables.css, so the PDF's colours are the screen's. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * The cell's colour, by the same rule as the screen's table: black without a
 * shift, grey on a closed day, the zone's colour in the shift's shade
 * otherwise, and white without a zone or for a shift the restaurant doesn't know.
 */
function cellColor(cell: PdfCell): string {
  if (cell.shade === "none") return token("--shift-none");
  if (cell.shade === "closed") return token("--shift-closed");
  if (cell.shade === "other" || cell.colour === null) return token("--surface");
  return token(paletteToken(cell.colour, cell.shade));
}

function addFont(doc: jsPDF, dataUrl: string, style: "normal" | "bold") {
  const file = `${FONT}-${style}.ttf`;
  doc.addFileToVFS(file, dataUrl.slice(dataUrl.indexOf(",") + 1));
  doc.addFont(file, FONT, style);
}

/**
 * The week as a PDF: A4 landscape, one restaurant per page, drawn like the
 * screen's tables (same cell text and colours) but without the position
 * headings: people follow each other in the screen's order. A restaurant with more people
 * than fit runs onto a next page with the day header repeated.
 */
export async function renderSchedulePdf(pages: PdfPage[], weekStart: string): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addFont(doc, regularUrl, "normal");
  addFont(doc, boldUrl, "bold");

  const ink = token("--schedule-ink");
  const grid = token("--schedule-grid");
  const sunken = token("--surface-sunken");

  pages.forEach((page, index) => {
    if (index > 0) doc.addPage();

    // The restaurant's colour (the top of its gradient) behind its name.
    doc.setFillColor(token(paletteToken(page.colour, "early")));
    doc.rect(MARGIN, MARGIN, PAGE_WIDTH - 2 * MARGIN, TITLE_HEIGHT, "F");
    doc.setTextColor(ink);
    const baseline = MARGIN + TITLE_HEIGHT / 2;
    doc.setFont(FONT, "bold").setFontSize(15);
    doc.text(page.restaurantName.toUpperCase(), MARGIN + 3, baseline, { baseline: "middle" });
    doc.setFont(FONT, "normal").setFontSize(11);
    doc.text(weekLabel(weekStart), PAGE_WIDTH - MARGIN - 3, baseline, {
      align: "right",
      baseline: "middle",
    });

    autoTable(doc, {
      startY: MARGIN + TITLE_HEIGHT + 3,
      margin: MARGIN,
      theme: "grid",
      styles: {
        font: FONT,
        fontSize: 9,
        textColor: ink,
        lineColor: grid,
        lineWidth: 0.2,
        halign: "center",
        valign: "middle",
        cellPadding: 1.6,
      },
      headStyles: { fillColor: sunken, textColor: ink, fontStyle: "bold" },
      columnStyles: {
        0: { halign: "left", cellWidth: NAME_WIDTH, fontStyle: "bold" },
        ...Object.fromEntries(page.days.map((_, day) => [day + 1, { cellWidth: DAY_WIDTH }])),
      },
      head: [
        ["", ...page.days.map((day) => day.name.toUpperCase())],
        ["", ...page.days.map((day) => (day.closed ? `${day.label} Closed` : day.label))],
      ],
      body: page.rows.map((row) => [
        row.name,
        ...row.cells.map((cell) => ({
          content: cell.text,
          styles: { fillColor: cellColor(cell) },
        })),
      ]),
    });
  });

  return doc.output("blob");
}
