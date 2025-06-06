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
            setCount(prev => {
              const newCount = prev + 1;
              countRef.current = newCount; // update ref now, not later
              return newCount;
            });
          }
          break;
        case 'g':
        case 'G':
          setCount(prev => {
            const newCount = prev - 1;
            countRef.current = newCount;
            return newCount;
          });
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


  return <div className='w-screen h-screen flex bg-[#f5f5f5]'>
    <div className='w-[40vw] mx-auto my-auto py-10 rounded-xl'>
      <img
        src="/Alphawin_logo.svg"
        alt="Alphawin Logo"
        className="w-full h-full object-contain"
      />
    </div>
    <div className='w-[40vw] mx-auto my-auto text-[#222222] py-10 rounded-xl'>
      {!submitted
      ? <div>
        {/* <div className='text-4xl text-center mb-4'>Person information</div> */}
        <div className='text-2xl w-1/2 mx-auto'>
        <div className='flex flex-col gap-2'>
          <div>
          <div className='text-center mb-5 text-4xl'>Кой ще се напомпа сега?</div>
          <input
            type='text'
            id='firstName'
            className='w-full border border-black rounded-lg px-2'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          </div>
        </div>
        </div>
      </div>
      : (() => {
        // Split the name into first and second part (by first space)
        const [firstName, ...rest] = name.trim().split(' ');
        const secondName = rest.join(' ');
        return (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-2">
          <div className="mt-auto w-full max-w-full flex flex-col items-center justify-center">
            <span className="text-8xl break-words px-2 truncate max-w-[90vw] inline-block">{firstName.toUpperCase()}</span>
            {secondName && (
            <span className="text-5xl break-words px-2 truncate max-w-[90vw] inline-block">{secondName.toUpperCase()}</span>
            )}
          </div>
            <div className="text-[12rem] flex justify-center w-full">
            <span className="inline-block">{countRef.current}</span>
          </div>
          <div className="mb-auto select-none text-6xl flex justify-center w-full">
            <span className="inline-block">Лицеви</span>
          </div>
          </div>
        );
        })()
      }
    </div>
  </div>
};

export default PushupsCounter;
