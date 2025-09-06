// src/app/api/sendToGoogleSheet/route.ts

import { id } from "@/app/constants/sheet";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
) {
  const { firstName, familyName, count, gender, age } =
    (await req.json()) as {
      firstName: string;
      familyName?: string;
      count: number;
      gender?: 'Men' | 'Women';
      age?: number | string;
    };

  try {
    const scriptResponse = await fetch(`https://script.google.com/macros/s/${id}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          firstName,
          familyName,
          age,
          gender,
          count,
          timestamp: new Date()
        },
      }),
      cache: "no-store"
    });

    const contentType = scriptResponse.headers.get('content-type') || '';

    if (!scriptResponse.ok) {
      let errorMessage = `Apps Script returned ${scriptResponse.status}`;
      try {
        if (contentType.includes('application/json')) {
          const errJson = (await scriptResponse.json()) as { message?: string };
          if (errJson?.message) errorMessage = errJson.message;
        } else {
          const text = await scriptResponse.text();
          errorMessage = `${errorMessage} - ${text.substring(0, 200)}`;
        }
      } catch (parseErr) {
        console.error("Failed to parse Apps Script error response:", parseErr);
      }
      console.error("Apps Script call failed:", errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    if (contentType.includes('application/json')) {
      const result = await scriptResponse.json();
      return NextResponse.json(result, { status: 200 });
    } else {
      const text = await scriptResponse.text();
      return NextResponse.json({ status: 'OK', response: text }, { status: 200 });
    }
  } catch (fetchErr: unknown) {
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
