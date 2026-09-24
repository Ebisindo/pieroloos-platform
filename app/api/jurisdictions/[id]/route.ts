import { NextResponse } from "next/server";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const j=await jurisdictionRepository.findById(id);if(!j)return NextResponse.json({error:"Jurisdiction not found."},{status:404});return NextResponse.json({data:j});}
