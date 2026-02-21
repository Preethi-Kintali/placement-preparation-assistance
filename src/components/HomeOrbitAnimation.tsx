import { useMemo } from "react";

type OrbitLabel = {
  id: string;
  className: string;
  text: string;
  svg: string;
};

function safeInlineSvg(svg: string) {
  return { __html: svg } as const;
}

export function HomeOrbitAnimation({ className = "" }: { className?: string }) {
  const labels = useMemo<OrbitLabel[]>(
    () => [
      {
        id: "label1",
        className: "home-orbit__label home-orbit__label--blue",
        text: "AI Interview",
        svg:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10"/><path d="M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10"/><path d="M2 12h20"/><path d="M12 2v20"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"/></svg>',
      },
      {
        id: "label2",
        className: "home-orbit__label home-orbit__label--green",
        text: "Study Assistant",
        svg:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><circle cx="15" cy="10" r="2"/><path d="M8 15c0-1 1.5-2 4-2s4 1 4 2"/><path d="M3 8h18" opacity="0.3"/></svg>',
      },
      {
        id: "label3",
        className: "home-orbit__label home-orbit__label--orange",
        text: "Roadmap",
        svg:
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/><circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/></svg>',
      },
    ],
    []
  );

  return (
    <div className={`home-orbit ${className}`} aria-hidden>
      <div className="home-orbit__system">
        <div className="home-orbit__ring home-orbit__ring--1" />
        <div className="home-orbit__ring home-orbit__ring--2" />
        <div className="home-orbit__ring home-orbit__ring--3" />

        <div className="home-orbit__path home-orbit__path--1">
          <div className={labels[0].className} id={labels[0].id}>
            <span className="home-orbit__icon" dangerouslySetInnerHTML={safeInlineSvg(labels[0].svg)} />
            <span>{labels[0].text}</span>
          </div>
        </div>

        <div className="home-orbit__path home-orbit__path--2">
          <div className={labels[1].className} id={labels[1].id}>
            <span className="home-orbit__icon" dangerouslySetInnerHTML={safeInlineSvg(labels[1].svg)} />
            <span>{labels[1].text}</span>
          </div>
        </div>

        <div className="home-orbit__path home-orbit__path--3">
          <div className={labels[2].className} id={labels[2].id}>
            <span className="home-orbit__icon" dangerouslySetInnerHTML={safeInlineSvg(labels[2].svg)} />
            <span>{labels[2].text}</span>
          </div>
        </div>

        <div className="home-orbit__panel">
          <div className="home-orbit__panelHeader">
            <span className="home-orbit__dot home-orbit__dot--red" />
            <span className="home-orbit__dot home-orbit__dot--yellow" />
            <span className="home-orbit__dot home-orbit__dot--green" />
            <span className="home-orbit__panelTitle">PLACEPREP.AI</span>
          </div>
          <div className="home-orbit__panelContent">
            <div className="home-orbit__codeLine" style={{ animationDelay: "0.4s" }}>
              <span className="home-orbit__ln">1</span>
              <span className="home-orbit__kw">import</span>
              <span className="home-orbit__br">{"{"}</span>
              <span className="home-orbit__fn">AI</span>
              <span className="home-orbit__br">{"}"}</span>
              <span className="home-orbit__kw">from</span>
              <span className="home-orbit__str">'placeprep'</span>
            </div>
            <div className="home-orbit__codeLine" style={{ animationDelay: "0.9s" }}>
              <span className="home-orbit__ln">2</span>
              <span className="home-orbit__cm">// Personalized plan</span>
            </div>
            <div className="home-orbit__codeLine" style={{ animationDelay: "1.4s" }}>
              <span className="home-orbit__ln">3</span>
              <span className="home-orbit__kw">const</span>
              <span className="home-orbit__var"> roadmap</span>
              <span> = </span>
              <span className="home-orbit__kw">new</span>
              <span className="home-orbit__fn"> AI</span>
              <span className="home-orbit__br">()</span>
            </div>
            <div className="home-orbit__codeLine" style={{ animationDelay: "1.9s" }}>
              <span className="home-orbit__ln">4</span>
              <span className="home-orbit__var">roadmap</span>
              <span>.</span>
              <span className="home-orbit__fn">analyze</span>
              <span className="home-orbit__br">(</span>
              <span className="home-orbit__str">'skills'</span>
              <span className="home-orbit__br">)</span>
            </div>
            <div className="home-orbit__codeLine" style={{ animationDelay: "2.4s" }}>
              <span className="home-orbit__ln">5</span>
              <span className="home-orbit__kw">await</span>
              <span className="home-orbit__var"> roadmap</span>
              <span>.</span>
              <span className="home-orbit__fn">success</span>
              <span className="home-orbit__br">()</span>
              <span className="home-orbit__cursor" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
