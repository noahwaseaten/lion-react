// src/app/api/sendToGoogleSheet/route.ts

import { userInformation } from "@/app/push-ups-counter/page";
import { NextResponse } from "next/server";

const tempId = "AKfycbxz0YgdPDID2VrAX42H3D9_UlrI06KCfAj4t2wZr2MuIQSlANlHF6YuQ_xAfmwFmjtc";

export async function POST(
  req: Request,
) {

  const { data } =
    (await req.json()) as {
      data: userInformation; // legacy used data: 
    };

  try {
    const scriptResponse = await fetch(`https://script.google.com/macros/s/${tempId}/exec`, {
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
