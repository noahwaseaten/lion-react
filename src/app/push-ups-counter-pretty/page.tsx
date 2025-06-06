'use client';
import { useEffect, useRef, useState } from 'react';

const PushupsCounter = () => {

  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(0);
  const nameRef = useRef(name);
  const submittedRef = useRef(submitted);
  const countRef = useRef(count);

  const sendToGoogleSheet = async () => {
    console.log({
      name,
      count
    });
    try {
      const res = await fetch('/api/sendToGoogleSheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: nameRef.current,
          count: countRef.current,
        }),
        cache: "no-store"
      });

      const contentType = res.headers.get('content-type');
      console.log(contentType);

      if (!res.ok) {
        // If it's JSON, try to parse the error
        if (contentType && contentType.includes('application/json')) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        } else {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status} - ${errText}`);
        }
      }

      if (contentType && contentType.includes('application/json')) {
        const result = await res.json();
        console.log('Saved to Google Sheets:', result);
      } else {
        const text = await res.text();
        console.log('Received non-JSON response:', text);
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error('Error sending to Google Sheet:', err.message);
      } else {
        console.error('Unknown error:', err);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setSubmitted(false);
          setName('');
          setCount(0);
          break;
        case 'Enter':
          if (submittedRef.current) {
            console.log('here');
            (async () => await sendToGoogleSheet())();
            setName('');
            setCount(0);
          } else {
            const input = document.getElementById('firstName') as HTMLInputElement;
            if (input) setName(input.value);
          }
          setSubmitted(prev => !prev);
          console.log('here2');
          break;
        case ' ':
          if (submittedRef.current) {
            e.preventDefault();
            setCount(prev => prev + 1);
          }
          break;
        case 'g':
        case 'G':
          setCount(prev => prev - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);


  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    countRef.current = count;
  }, [count]);


  return <div className='w-screen h-screen flex flex-col'>
    <div className='w-[40vw] mx-auto my-auto bg-zinc-900 py-10 rounded-xl'>
      {!submitted
        ? <div>
          {/* <div className='text-4xl text-center mb-4'>Person information</div> */}
          <div className='text-2xl w-1/2 mx-auto'>
            <div className='flex flex-col gap-2'>
              <div>
                <div className='text-center'>ENTER NAME</div>
                <input
                  type='text'
                  id='firstName'
                  className='w-full bg-[#0a0a0a] rounded-lg px-2'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        : <div className='text-center text-2xl flex flex-col gap-2 h-[50vh]'>
          <div className='mt-auto text-4xl'>{name.toUpperCase()}</div>
          <div className='text-6xl'>{countRef.current}</div>
          <div className='mb-auto select-none'>push-ups</div>
        </div>
      }
    </div>
  </div>
};

export default PushupsCounter;
