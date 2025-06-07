// src/app/api/sendToGoogleSheet/route.ts

import { id } from "@/app/constants/sheet";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
) {

  const { firstName, familyName, count } =
    (await req.json()) as {
      firstName: string;
      familyName: string;
      count: number;
    };

  try {
    const scriptResponse = await fetch(`https://script.google.com/macros/s/${id}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          firstName,
          familyName,
          count,
          timestamp: new Date()
        },
      }),
      cache: "no-store"
    }
    );

    if (!scriptResponse.ok) {
      let errorMessage = `Apps Script returned ${scriptResponse.status}`;
      try {
        const errJson = (await scriptResponse.json()) as { message?: string };
        if (errJson?.message) {
          errorMessage = errJson.message;
        }
      } catch (parseErr) {
        console.error("Failed to parse Apps Script error JSON:", parseErr);
      }
      console.error("Apps Script call failed:", errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const result = await scriptResponse.json();
    return NextResponse.json(result, { status: 200 });
  } catch (fetchErr: unknown) {
    // Log the raw error to the Next.js console
    let message = "Unknown server error";
    if (fetchErr instanceof Error) {
      message = fetchErr.message;
    } else if (typeof fetchErr === "object" && fetchErr !== null) {
      message = JSON.stringify(fetchErr);
    } else if (typeof fetchErr === "string") {
      message = fetchErr;
    }
    console.error("Error in sendToGoogleSheet /fetch:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
