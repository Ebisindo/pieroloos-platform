import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({data:{
    portfolioStatus:"HEALTHY", progress:0,
    counts:{total:0,notStarted:0,inProgress:0,inReview:0,overdue:0,blocked:0,compliant:0}
  }});
}
