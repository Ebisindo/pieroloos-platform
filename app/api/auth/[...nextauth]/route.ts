import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfigured, authOptions, getAuthConfigProblems } from "@/lib/auth/auth-options";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

function unavailable() {
  console.error("Authentication is not configured.", getAuthConfigProblems());
  return NextResponse.json({ error: "Authentication is unavailable." }, { status: 503 });
}

export function GET(request: Request, context: RouteContext) {
  return authConfigured ? handler(request, context) : unavailable();
}

export function POST(request: Request, context: RouteContext) {
  return authConfigured ? handler(request, context) : unavailable();
}
