// src/app/api/sendToGoogleSheet/route.ts

import { NextResponse } from "next/server";

const tempId = "AKfycbz3JqL3VcrgtMX9A750TFwxabg-BxkotQXrh6iv3iUwuyzJKQM_jLJejpPLJwHZknza";

export async function POST(
  req: Request,
) {

  const { count, name } =
    (await req.json()) as {
      count: number;
      name: string; // legacy used data: userInformation
    };

  try {
    const scriptResponse = await fetch(`https://script.google.com/macros/s/${tempId}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          firstName: name,
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
