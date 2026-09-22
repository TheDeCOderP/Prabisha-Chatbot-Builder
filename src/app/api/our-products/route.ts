import { NextResponse } from "next/server";

// Prabisha's small internal product registry — maintained in one place
// (tenant-boilerplate's src/lib/prabisha-products.ts) and served publicly so
// every Prabisha repo's switcher (this one, pm, DMA) fetches the same list
// instead of each hardcoding its own copy. Proxied through this repo's own
// route (rather than fetched directly from the client) so the panel keeps
// working the same way pm/DMA's already-proven pattern does, and so a future
// change to the upstream response shape only needs updating in one place per
// repo instead of inside the shared UI component.
export async function GET() {
  try {
    const response = await fetch("https://apps.prabisha.com/api/public/prabisha-products", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    const products: Array<{ slug: string; name: string; description: string; url: string; logoUrl?: string | null; color?: string }> =
      await response.json();

    const data = products.map((p) => ({
      id: p.slug,
      name: p.name,
      type: "INTERNAL_TOOL",
      url: p.url,
      description: p.description,
      logoUrl: p.logoUrl ?? null,
      mainImageUrl: null,
      color: p.color ?? "blue",
      category: { id: p.slug, name: "Prabisha", slug: "prabisha" },
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Prabisha products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
