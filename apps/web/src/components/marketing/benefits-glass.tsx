import { Container, Section } from "../ui/layout";
import { values } from "./content";

export function BenefitsGlass() {
  return (
    <Section className="values-section" aria-label="مزیت‌های وقتیمو">
      <Container className="benefits-scene">
        <div className="benefits-light" aria-hidden="true">
          <svg viewBox="0 0 1200 180" preserveAspectRatio="none" focusable="false">
            <defs>
              <linearGradient id="glass-light-flow" x1="0" x2="1">
                <stop stopColor="#9363ec" stopOpacity=".62" />
                <stop offset=".35" stopColor="#d2b9fb" stopOpacity=".24" />
                <stop offset=".67" stopColor="#c7b6ff" stopOpacity=".32" />
                <stop offset="1" stopColor="#8061e5" stopOpacity=".66" />
              </linearGradient>
              <filter id="glass-light-lens" x="-8%" y="-40%" width="116%" height="180%">
                <feTurbulence type="fractalNoise" baseFrequency=".004 .019" numOctaves="1" seed="5" result="waves" />
                <feDisplacementMap in="SourceGraphic" in2="waves" scale="17" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <g filter="url(#glass-light-lens)" fill="url(#glass-light-flow)">
              <path d="M-24 18C159 37 254 78 421 65C592 52 759-23 943 19C1045 42 1110 71 1224 38V161C1105 174 1061 135 945 117C755 89 606 161 407 151C240 143 110 94-24 127Z" />
              <path opacity=".55" d="M-27 123C102 80 222 145 389 139C515 135 636 95 778 101C906 107 1010 165 1227 113V167C1067 191 908 170 753 145C612 122 522 179 358 177C177 175 122 132-27 173Z" />
            </g>
          </svg>
        </div>
        <ul className="values-strip liquid-glass" role="list">
          {values.map(({ icon: Icon, title, description }) => (
            <li key={title}>
              <span className="benefit-icon"><Icon size={25} strokeWidth={2} aria-hidden="true" /></span>
              <div><h2>{title}</h2><p>{description}</p></div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
