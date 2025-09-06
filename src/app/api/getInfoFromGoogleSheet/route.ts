import { id } from '@/app/constants/sheet';
import { NextResponse } from 'next/server';

// Types for normalization
type Gender = 'Men' | 'Women';
interface RowApi {
  firstName?: string;
  lastName?: string;
  name?: string;
  familyName?: string;
  count?: number | string;
  pushUps?: number | string;
  pushups?: number | string;
  gender?: Gender | 'Male' | 'Female' | string;
  [k: string]: unknown;
}
interface NormalizedRow {
  firstName: string;
  lastName: string;
  count: number;
  gender?: Gender;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const nocache = url.searchParams.get('nocache');
    const scriptUrl = `https://script.google.com/macros/s/${id}/exec${nocache ? `?nocache=${nocache}` : ''}`;
    const res = await fetch(scriptUrl, { cache: 'no-store' });

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      const text = await res.text();
      console.error('Apps Script non-OK response:', res.status, text);
      return NextResponse.json({ error: `Apps Script returned ${res.status}`, details: text }, { status: 500 });
    }

    if (contentType.includes('application/json')) {
      const raw = (await res.json()) as unknown;
      if (Array.isArray(raw)) {
        const normalized: NormalizedRow[] = (raw as unknown[]).map((d) => {
          const r = d as RowApi;
          const first = (r.firstName ?? r.name ?? '').toString().trim();
          const last = (r.lastName ?? r.familyName ?? '').toString().trim();
          const count = Number(r.count ?? r.pushUps ?? r.pushups ?? 0) || 0;
          const g = r.gender;
          const gender: Gender | undefined = g === 'Male' ? 'Men' : g === 'Female' ? 'Women' : (g as Gender | undefined);
          return { firstName: first, lastName: last, count, gender };
        });
        return NextResponse.json(normalized);
      }
      if (raw && typeof raw === 'object' && (raw as { status?: string }).status === 'ERROR') {
        return NextResponse.json(raw);
      }
      return NextResponse.json([]);
    } else {
      const text = await res.text();
      console.error('Expected JSON from Apps Script, got:', contentType, text?.slice(0, 200));
      return NextResponse.json({ error: 'Invalid response from Apps Script', contentType, preview: text?.slice(0, 200) }, { status: 500 });
    }
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
