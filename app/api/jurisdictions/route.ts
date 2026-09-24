import { NextResponse } from "next/server";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { jurisdictionCreateSchema } from "@/lib/validation/jurisdiction";
export async function GET(){return NextResponse.json({data:await jurisdictionRepository.list()});}
export async function POST(req:Request){const p=jurisdictionCreateSchema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:"Validation failed",issues:p.error.flatten()},{status:422});return NextResponse.json({data:await jurisdictionRepository.create(p.data)},{status:201});}
