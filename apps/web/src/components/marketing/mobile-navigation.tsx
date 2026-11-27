"use client";

import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { BarbellIcon as Dumbbell } from "@phosphor-icons/react/dist/ssr/Barbell";
import { SignInIcon as LogIn } from "@phosphor-icons/react/dist/ssr/SignIn";
import { ListIcon as Menu } from "@phosphor-icons/react/dist/ssr/List";
import { VolleyballIcon as Volleyball } from "@phosphor-icons/react/dist/ssr/Volleyball";
import { WavesIcon as Waves } from "@phosphor-icons/react/dist/ssr/Waves";
import { WindIcon as Wind } from "@phosphor-icons/react/dist/ssr/Wind";
import { HouseIcon as House } from "@phosphor-icons/react/dist/ssr/House";
import { SquaresFourIcon as Grid2X2 } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { StackIcon as Layers3 } from "@phosphor-icons/react/dist/ssr/Stack";
import { TagIcon as Tag } from "@phosphor-icons/react/dist/ssr/Tag";
import { HeadsetIcon as Headphones } from "@phosphor-icons/react/dist/ssr/Headset";
import { BookOpenIcon as BookOpen } from "@phosphor-icons/react/dist/ssr/BookOpen";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Drawer } from "../ui/overlay";
import { ButtonLink } from "../ui/buttons";
import { features, marketingHref, navLinks, solutions } from "./content";
import { DemoButton } from "./demo";

const menuIcons = {
  "/": House, "#features": Grid2X2, "#solutions": Layers3, "#pricing": Tag, "#support": Headphones, "#faq": BookOpen,
};
const solutionIcons = { gyms: Dumbbell, "yoga-pilates": Wind, academies: Volleyball, pools: Waves };
const menuSolutions = Object.keys(solutionIcons).flatMap(slug => solutions.filter(solution => solution.slug === slug));
const menuLinks = [
  { href: "/", label: "خانه" },
  ...navLinks,
  { href: "#faq", label: "سؤالات متداول" },
] as const;

function MenuIcon({ destination }: { destination: keyof typeof menuIcons }) {
  const Icon = menuIcons[destination];
  return <Icon weight="fill" size={21} aria-hidden="true" />;
}

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function MobileNavigation({ onSolution, brand }: { onSolution: boolean; brand: ReactNode }) {
  const panel = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const solutionListId = useId();
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash, () => "");
  const active = onSolution
    ? (["#pricing", "#support", "#faq"].includes(hash) ? hash : "#solutions")
    : (features.some(({ id }) => hash === `#${id}`) ? "#features" : hash || "/");

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 57rem)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) panel.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="mobile-nav">
      <Drawer dialogRef={panel} title="منوی وقتیمو"
        onClose={() => setSolutionsOpen(false)}
        heading={<div className="mobile-menu-brand">{brand}</div>}
        trigger={{ label: "باز کردن منو", icon: <Menu weight="fill" size={24} aria-hidden="true" />, iconOnly: true, ref: opener }}>
        <nav aria-label="ناوبری موبایل" className="mobile-menu">
          {menuLinks.map(({ href, label }) => {
            if (href === "#solutions") {
              return (
                <div key={href} className="mobile-menu-group">
                  <button type="button" className="mobile-menu-row"
                    aria-expanded={solutionsOpen} aria-controls={solutionListId}
                    data-section-active={active === href || solutionsOpen ? "" : undefined}
                    onClick={() => setSolutionsOpen(open => !open)}>
                    <MenuIcon destination={href} />
                    <span>{label}</span>
                    <ChevronLeft weight="fill" className="mobile-menu-chevron" size={17} aria-hidden="true" />
                  </button>
                  <div id={solutionListId} className="mobile-menu-submenu" inert={!solutionsOpen}>
                    <ul>
                      {menuSolutions.map(({ slug, title }) => {
                        const solutionHref = `/solutions/${slug}`;
                        const SolutionIcon = solutionIcons[slug];
                        return (
                          <li key={slug}>
                            <a href={solutionHref} data-close-drawer tabIndex={0}
                              aria-current={pathname === solutionHref ? "page" : undefined}>
                              <SolutionIcon weight="fill" size={17} aria-hidden="true" />
                              {title}
                            </a>
                          </li>
                        );
                      })}
                      <li>
                        <a href={marketingHref(href, onSolution)} data-close-drawer tabIndex={0}
                          className="mobile-menu-overview"
                          aria-current={!onSolution && active === href ? "location" : undefined}>همهٔ راهکارها</a>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            }
            return (
              <a key={href} className="mobile-menu-row"
                href={href === "/" || href === "#faq" ? href : marketingHref(href, onSolution)}
                tabIndex={0} data-close-drawer data-section-active={active === href ? "" : undefined}
                aria-current={active === href ? (href === "/" ? "page" : "location") : undefined}>
                <MenuIcon destination={href} />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
        <div className="mobile-menu-actions">
          <DemoButton prepareOpen={() => {
            panel.current?.close();
            return opener.current;
          }} />
          <ButtonLink href="#sign-in" variant="secondary" data-close-drawer><LogIn weight="fill" size={18} aria-hidden="true" />ورود به حساب</ButtonLink>
        </div>
      </Drawer>
    </div>
  );
}
