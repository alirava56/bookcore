"use client";

import { LogIn, Menu } from "lucide-react";
import { useEffect, useRef } from "react";
import { Drawer } from "../ui/overlay";
import { ButtonLink } from "../ui/buttons";
import { marketingHref, navLinks } from "./content";

export function MobileNavigation({ onSolution }: { onSolution: boolean }) {
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 57rem)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) menu.current?.querySelector<HTMLDialogElement>("dialog[open]")?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="mobile-nav" ref={menu}>
      <Drawer title="منوی وقتیمو" trigger={{ label: "باز کردن منو", icon: <Menu size={23} aria-hidden="true" />, iconOnly: true }}>
        <nav aria-label="ناوبری موبایل" className="mobile-menu">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={marketingHref(href, onSolution)} tabIndex={0} data-close-drawer
              data-section-active={onSolution && href === "#solutions" ? "" : undefined}>{label}</a>
          ))}
          <ButtonLink href="#sign-in" variant="secondary" data-close-drawer><LogIn size={17} aria-hidden="true" />ورود</ButtonLink>
        </nav>
      </Drawer>
    </div>
  );
}
