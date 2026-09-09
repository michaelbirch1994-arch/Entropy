import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RosterPartyMember } from "./RosterView";

const props = { account: "A-long-player-account.1234", character: "A fully visible character name", profession: "Firebrand", uptime: 72.4, selected: false, onSelect: () => {} };

describe("Roster party presentation", () => {
  it("shows full identity and the unchanged rounded uptime", () => {
    const html = renderToStaticMarkup(<RosterPartyMember {...props} />);
    expect(html).toContain(props.account);
    expect(html).toContain(props.character);
    expect(html).toContain('data-profession-family="guardian"');
    expect(html).toContain("72<small>%</small>");
    expect(html).toContain('width:72.4%');
    expect(html).toContain('aria-label="View A-long-player-account.1234 in Roster Intel"');
    expect(html).not.toMatch(/truncate|line-clamp/);
  });

  it("keeps the supplied value while bounding only the decorative meter", () => {
    const html = renderToStaticMarkup(<RosterPartyMember {...props} uptime={105} selected />);
    expect(html).toContain("105<small>%</small>");
    expect(html).toContain('width:100%');
    expect(html).toContain('data-selected="true"');
  });

  it("renders a zero value and unknown profession without inventing activity", () => {
    const html = renderToStaticMarkup(<RosterPartyMember {...props} uptime={0} profession="Unknown" />);
    expect(html).toContain("0<small>%</small>");
    expect(html).toContain('width:0%');
    expect(html).toContain('data-profession-family="default"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});
