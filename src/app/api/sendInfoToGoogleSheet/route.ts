// src/app/api/sendToGoogleSheet/route.ts

import { id } from "@/app/constants/sheet";
import { NextResponse } from "next/server";

// Define a local copy of the expected payload shape to avoid importing from a page file
type UserInformation = {
  firstName: string;
  familyName: string;
  age: number | string;
  gender: 'Male' | 'Female' | 'Men' | 'Women';
  type: 'Participant' | 'Civilian' | 'Volunteer';
  bib?: number | string;
  category?: string;
  phoneNumber?: string;
  notes?: string;
};

export async function POST(
  req: Request,
) {

  const { data } =
    (await req.json()) as {
      data: UserInformation; // legacy used data:
    };

  try {
    const scriptResponse = await fetch(`https://script.google.com/macros/s/${id}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          ...data,
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

    const contentType = scriptResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const result = await scriptResponse.json();
      return NextResponse.json(result, { status: 200 });
    } else {
      const text = await scriptResponse.text();
      return NextResponse.json({ status: 'OK', response: text }, { status: 200 });
    }
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
