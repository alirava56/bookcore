import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteOrigin } from "@/app/site-metadata";
import { industries, industrySlugs } from "@/components/marketing/industry-content";
import { IndustryPage } from "@/components/marketing/industry-page";

type RouteProps = { params: Promise<{ slug: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return industrySlugs.map((slug) => ({ slug }));
}

async function resolveSlug(params: RouteProps["params"]) {
  const { slug } = await params;
  const match = industrySlugs.find((candidate) => candidate === slug);
  if (!match) notFound();
  return match;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  const { seoTitle: title, seoDescription: description } = industries[slug];
  const path = `/solutions/${slug}`;
  return {
    title,
    description,
    alternates: siteOrigin ? { canonical: path } : undefined,
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: "وقتیمو",
      title,
      description,
      ...(siteOrigin && {
        url: path,
        images: [{ url: "/assets/social-card.webp", width: 1200, height: 630, alt: "تقویم و دمبل وقتیمو" }],
      }),
    },
  };
}

export default async function Page({ params }: RouteProps) {
  const slug = await resolveSlug(params);
  const url = siteOrigin && new URL(`/solutions/${slug}`, siteOrigin).href;
  const structuredData = siteOrigin && url && {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: siteOrigin.href },
      { "@type": "ListItem", position: 2, name: industries[slug].name, item: url },
    ],
  };

  return (
    <>
      {structuredData && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      )}
      <IndustryPage slug={slug} />
    </>
  );
}
