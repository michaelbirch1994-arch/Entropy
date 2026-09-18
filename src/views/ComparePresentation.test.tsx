import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportMetricTable } from "./CompareView";

function render(a: number, b: number, higherIsBetter = true) {
  return renderToStaticMarkup(<ReportMetricTable titleA="First session" titleB="Second session" rows={[
    { label: "Metric", a, b, higherIsBetter, fmt: String },
  ]} />);
}

describe("Report comparisons", () => {
  it("does not give either report a winning highlight for a tie", () => {
    const html = render(100, 100);
    expect(html).toContain("Equal");
    expect(html).not.toContain("text-emerald-400");
  });

  it("preserves zero totals without invalid decorative widths", () => {
    const html = render(0, 0);
    expect(html.match(/width:0%/g)).toHaveLength(2);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("highlights the lower value when lower is better", () => {
    const html = render(8, 3, false);
    expect(html).toMatch(/text-theme-text\/80">8/);
    expect(html).toMatch(/text-emerald-400">3/);
    expect(html).toContain("width:37.5%");
  });

  it("keeps totals intact and supplies row and column headings", () => {
    const html = render(2500, 1000);
    expect(html).toMatch(/text-emerald-400">2500/);
    expect(html).toContain('scope="row"');
    expect(html.match(/scope="col"/g)).toHaveLength(3);
    expect(html).toContain("width:40%");
  });
});
