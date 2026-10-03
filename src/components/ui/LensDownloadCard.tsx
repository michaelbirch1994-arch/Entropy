import { ArrowDown, ArrowUpRight, Download, Monitor } from "lucide-react";

const RELEASE_URL = "https://github.com/michaelbirch1994-arch/Entropy/releases/tag/lens-live-0.3.39-r63";
const DOWNLOAD_URL = "https://github.com/michaelbirch1994-arch/Entropy/releases/download/lens-live-0.3.39-r63/LENS-Live-0.3.39-r63-Windows.zip";

export function LensDownloadShortcut() {
  return (
    <a className="lens-home-shortcut" href="#lens-live">
      Get the in-game meter <ArrowDown size={13} aria-hidden="true" />
    </a>
  );
}

export default function LensDownloadCard() {
  return (
    <section className="lens-download-card" id="lens-live" aria-labelledby="lens-download-title">
      <div className="lens-download-header">
        <span><Monitor size={13} aria-hidden="true" /> In-game combat meter</span>
        <span className="lens-release-badge">Beta · r63</span>
      </div>

      <div className="lens-download-art">
        <img
          src={`${import.meta.env.BASE_URL}images/lens-logo-transparent.png`}
          alt="LENS aperture and star logo"
          width="1254"
          height="1254"
          decoding="async"
        />
      </div>

      <div className="lens-download-body">
        <h2 id="lens-download-title">LENS <span>Live</span></h2>
        <p className="lens-download-description">
          Keep the fight in focus. Damage, healing, cleanses and strips,
          with player details and fight history inside Guild Wars 2.
        </p>

        <a className="lens-download-button" href={DOWNLOAD_URL}>
          <Download size={17} aria-hidden="true" />
          Download for Windows
          <ArrowDown size={15} aria-hidden="true" />
        </a>
        <div className="lens-download-meta">
          <span>Windows 64-bit · ZIP · 33 MB</span>
          <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer">
            Release notes <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>

        <details className="lens-install-guide">
          <summary>Installation &amp; updates</summary>
          <ol>
            <li>Download and extract the ZIP.</li>
            <li>Close Guild Wars 2, then run the included Setup.</li>
            <li>Launch the game. Use the same installer for updates.</li>
          </ol>
          <p>Setup may still say EntropyLive. Your existing settings and Arc installation are preserved.</p>
        </details>
      </div>
    </section>
  );
}
