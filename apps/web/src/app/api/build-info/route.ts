import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const readBuildIdFromFile = async (): Promise<string | null> => {
  try {
    const filePath = path.join(process.cwd(), ".next", "BUILD_ID");
    const buildId = (await readFile(filePath, "utf8")).trim();
    return buildId.length > 0 ? buildId : null;
  } catch {
    return null;
  }
};

const resolveBuildId = async () => {
  const fileBuildId = await readBuildIdFromFile();
  if (fileBuildId) return fileBuildId;

  const envBuildId =
    process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
  if (envBuildId) return envBuildId;

  if (process.env.NODE_ENV === "production") {
    return "unknown-production-build";
  }

  return "development";
};

export async function GET() {
  const buildId = await resolveBuildId();

  return NextResponse.json(
    {
      buildId,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
