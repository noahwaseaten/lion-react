import { id } from '@/app/constants/sheet';
import { NextResponse } from 'next/server';

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
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map((d: any) => ({
            firstName: d.firstName ?? d.name ?? '',
            lastName: d.lastName ?? d.familyName ?? '',
            count: Number(d.count ?? d.pushUps ?? d.pushups ?? 0) || 0,
            // include gender if present so we can filter Top 5 client-side
            gender: (d.gender === 'Male' ? 'Men' : d.gender === 'Female' ? 'Women' : d.gender) ?? undefined,
          }))
        : (data && data.status === 'ERROR') ? data : [];
      return NextResponse.json(normalized);
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
