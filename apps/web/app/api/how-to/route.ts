import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const configRow = await prisma.appConfig.findUnique({
      where: { key: "how_to_guide_pages" },
    });

    if (!configRow?.value) {
      return NextResponse.json({ pages: [] });
    }

    const pages = JSON.parse(configRow.value);
    return NextResponse.json({ pages: Array.isArray(pages) ? pages : [] });
  } catch (error) {
    console.error("Failed to fetch how-to guide pages:", error);
    return NextResponse.json({ pages: [] });
  }
}
