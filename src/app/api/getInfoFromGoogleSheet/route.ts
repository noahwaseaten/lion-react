import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Types for normalization
type Gender = 'Men' | 'Women';
interface NormalizedRow {
  firstName: string;
  lastName: string;
  count: number;
  gender?: Gender;
}

type UnknownRow = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalize = (raw: ReadonlyArray<UnknownRow>): NormalizedRow[] => {
  return (raw || []).map((r) => {
    const first = str(r.first_name ?? r.firstName ?? r.name).trim();
    const last = str(r.last_name ?? r.lastName ?? r.familyName).trim();
    const count = num(r.count ?? r.pushUps ?? r.pushups) || 0;
    const g = r.gender;
    const gender: Gender | undefined = g === 'Male' ? 'Men' : g === 'Female' ? 'Women' : (g as Gender | undefined);
    return { firstName: first, lastName: last, count, gender };
  });
};

export async function GET(request: Request) {
  const useSupabase = process.env.DATA_PROVIDER?.toLowerCase() === 'supabase';
  if (!useSupabase) {
    // Fallback to Google Sheets proxy (existing behavior)
    const { id } = await import('@/app/constants/sheet');
    try {
      const url = new URL(request.url);
      const nocache = url.searchParams.get('nocache');
      const scriptUrl = `https://script.google.com/macros/s/${id}/exec${nocache ? `?nocache=${nocache}` : ''}`;
      const res = await fetch(scriptUrl, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: `Apps Script returned ${res.status}`, details: text }, { status: 500 });
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const text = await res.text();
        return NextResponse.json({ error: 'Invalid response from Apps Script', contentType: ct, preview: text?.slice(0,200) }, { status: 500 });
      }
      const raw = await res.json();
      const rows = Array.isArray(raw) ? normalize(raw as ReadonlyArray<UnknownRow>) : [];
      const cacheHeader = nocache ? 'no-store' : 's-maxage=300, stale-while-revalidate=60';
      return NextResponse.json(rows, { headers: { 'Cache-Control': cacheHeader } });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
  }

  // Supabase path
  try {
    const url = new URL(request.url);
    const nocache = url.searchParams.get('nocache');
    const supabase = getSupabaseAdmin();

    // Fetch all attempts (you keep client-side filtering/sorting/caching)
    const { data, error } = await supabase
      .from('attempts')
      .select('first_name, last_name, gender, count')
      .order('created_at', { ascending: false });

    if (error) {
      if (process.env.NODE_ENV !== 'production') console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = normalize((data ?? []) as ReadonlyArray<UnknownRow>);

    // Honor nocache=true by disabling CDN cache; otherwise allow shared cache for 5 minutes
    const cacheHeader = nocache ? 'no-store' : 's-maxage=300, stale-while-revalidate=60';
    return NextResponse.json(rows, { headers: { 'Cache-Control': cacheHeader } });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Error fetching from Supabase:', err);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
