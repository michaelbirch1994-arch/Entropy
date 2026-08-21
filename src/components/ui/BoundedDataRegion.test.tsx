import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BoundedDataRegion from "./BoundedDataRegion";

describe("BoundedDataRegion", () => {
  it("exposes a labelled, keyboard-focusable region without removing content", () => {
    const markup = renderToStaticMarkup(
      <BoundedDataRegion label="Critical event feed, 2 events" itemCount={2} maxHeightClass="max-h-56">
        <div>First event</div>
        <div>Second event</div>
      </BoundedDataRegion>,
    );

    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-label="Critical event feed, 2 events"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('data-item-count="2"');
    expect(markup).toContain("First event");
    expect(markup).toContain("Second event");
    expect(markup).toContain("max-h-56");
    expect(markup).toContain("overflow-y-auto");
  });

  it("supports tables that need honest horizontal and vertical overflow", () => {
    const markup = renderToStaticMarkup(
      <BoundedDataRegion label="Distance table" scrollAxes="both">
        <table><tbody><tr><td>Player</td></tr></tbody></table>
      </BoundedDataRegion>,
    );

    expect(markup).toContain("overflow-auto");
    expect(markup).not.toContain("overflow-y-auto");
  });
});
