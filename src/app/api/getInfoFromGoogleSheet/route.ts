import { id } from '@/app/constants/sheet';
import { NextResponse } from 'next/server';

export async function GET() {

  try {
    const res = await fetch(`https://script.google.com/macros/s/${id}/exec`);
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Google Sheet data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
