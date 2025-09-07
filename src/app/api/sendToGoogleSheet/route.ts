// src/app/api/sendToGoogleSheet/route.ts

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const useSupabase = process.env.DATA_PROVIDER?.toLowerCase() === 'supabase';

  const body = (await req.json()) as {
    firstName: string;
    familyName?: string;
    count: number;
    gender?: 'Men' | 'Women';
    age?: number | string;
  };

  const firstName = (body.firstName || '').trim();
  const lastName = (body.familyName || '').trim();
  const count = Number(body.count) || 0;
  const gender = body.gender === 'Women' ? 'Women' : 'Men';
  const age = body.age == null || body.age === '' ? null : Number(body.age) || null;

  if (!useSupabase) {
    // Fallback to existing Apps Script proxy
    const { id } = await import('@/app/constants/sheet');
    try {
      const scriptResponse = await fetch(`https://script.google.com/macros/s/${id}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { firstName, familyName: lastName, age, gender, count, timestamp: new Date() },
        }),
        cache: "no-store",
      });

      const contentType = scriptResponse.headers.get('content-type') || '';
      if (!scriptResponse.ok) {
        let err = `Apps Script returned ${scriptResponse.status}`;
        try {
          if (contentType.includes('application/json')) {
            const j = await scriptResponse.json();
            err = (j as { message?: string })?.message || err;
          } else {
            err = `${err} - ${(await scriptResponse.text()).slice(0,200)}`;
          }
        } catch {}
        return NextResponse.json({ error: err }, { status: 500 });
      }

      if (contentType.includes('application/json')) {
        const result = await scriptResponse.json();
        return NextResponse.json(result, { status: 200 });
      } else {
        const text = await scriptResponse.text();
        return NextResponse.json({ status: 'OK', response: text }, { status: 200 });
      }
    } catch {
      return NextResponse.json({ error: 'Failed to write to Apps Script' }, { status: 500 });
    }
  }

  // Supabase path
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('attempts').insert({
      first_name: firstName,
      last_name: lastName,
      gender,
      count,
      age,
    });

    if (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'OK' }, { status: 200 });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Error writing to Supabase:', err);
    return NextResponse.json({ error: 'Failed to write to database' }, { status: 500 });
  }
}
