import Image from "next/image";
import Link from "next/link";

export function Logo({ light = false, closeDrawer = false, showEnglish = true }: {
  light?: boolean;
  closeDrawer?: boolean;
  showEnglish?: boolean;
}) {
  return (
    <Link className={`brand-logo ${light ? "brand-logo--light" : ""}`} href="/" prefetch={false} tabIndex={0}
      data-close-drawer={closeDrawer || undefined}>
      <span className="brand-mark">
        <Image src="/assets/vaghtimo-mark.webp" width={144} height={122} unoptimized alt="" />
      </span>
      <span className="brand-wordmark">
        <strong>وقتیمو</strong>
        {showEnglish && <bdi lang="en">Vaghtimo</bdi>}
      </span>
      <span className="sr-only">صفحهٔ اصلی</span>
    </Link>
  );
}
