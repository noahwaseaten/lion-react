'use client';
import { useEffect, useRef, useState } from 'react';
import NumberFlow, { continuous } from '@number-flow/react';
import Image from 'next/image';

const LogoSwitcher = () => {
  const [currentLogo, setCurrentLogo] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLogo(prev => prev === 0 ? 1 : 0);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const logos = [
    "/Alphawin_logo.svg",
    "/lionheart.svg"
  ];

  return (
    <div className="relative w-full" style={{ height: '300px' }}>
      <Image
        src={logos[currentLogo]}
        alt={currentLogo === 0 ? "Alphawin Logo" : "Lion Heart Logo"}
        className="transition-opacity duration-500"
        fill
        sizes="(max-width: 768px) 100vw, 40vw"
        style={{ objectFit: 'contain' }}
        priority
      />
    </div>
  );
};

const PushupsCounter = () => {

  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(0);
  const nameRef = useRef(name);
  const submittedRef = useRef(submitted);
  const countRef = useRef(count);

  const [isTopFiveView, setIsTopFiveView] = useState(false);
  const isTopFiveViewRef = useRef(isTopFiveView);

  const [topFive, setTopFive] = useState([] as { firstName: string, lastName?: string, count: number }[]);
  const [topFiveFetchAnimation, setTopFiveFetchAnimation] = useState(false);

  const sendToGoogleSheet = async () => {
    try {
      const res = await fetch('/api/sendToGoogleSheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: nameRef.current.split(' ')[0],
          familyName: nameRef.current.split(' ').slice(1).join(''),
          count: countRef.current,
        }),
        cache: "no-store"
      });

      const contentType = res.headers.get('content-type');

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

  const getFromGoogleSheet = async () => {
    try {
      const res = await fetch('/api/getInfoFromGoogleSheet');
      const data = await res.json();
      console.log('Fetched sheet data:', data);
      handleGoogleSheetsInfo(data);
      return data;
    } catch (err) {
      console.error('Error fetching from internal API:', err);
      return null;
    }
  };

  const handleGoogleSheetsInfo = (info: { firstName: string, lastName?: string, count: number }[]) => {
    setTopFiveFetchAnimation(true);
    setTimeout(() => {
      setTopFive(info.filter(a => a.count).sort((a, b) => b.count - a.count).slice(0, 5));
      setTopFiveFetchAnimation(false);
    }, 300);
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
            (async () => await sendToGoogleSheet())();
            setName('');
            setCount(0);
          } else {
            const input = document.getElementById('firstName') as HTMLInputElement;
            if (input) setName(input.value);
          }
          setSubmitted(prev => !prev);
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
          if (submittedRef.current) {
            setCount(prev => {
              const newCount = prev - 1;
              countRef.current = newCount;
              return newCount;
            });
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          setIsTopFiveView(!isTopFiveViewRef.current);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  useEffect(() => {
    getFromGoogleSheet();
  }, [getFromGoogleSheet]);

  useEffect(() => {
    if (isTopFiveView) {
      getFromGoogleSheet();
    }
  }, [isTopFiveView, getFromGoogleSheet]);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    countRef.current = count;
  }, [count]);

  useEffect(() => {
    isTopFiveViewRef.current = isTopFiveView;
  }, [isTopFiveView]);

  return <div className='w-screen h-screen flex bg-[#f5f5f5]'>    <div className='w-[40vw] mx-auto my-auto py-10 rounded-xl'>
    <LogoSwitcher />
  </div>
    <div className='relative z-10 w-[50vw] mr-0 text-[#222222] py-10 rounded-xl select-none'>
      {!submitted
        ? <div>
          {/* <div className='text-4xl text-center mb-4'>Person information</div> */}
          <div className={`absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/2 transition-opacity duration-300 ${!isTopFiveView ? 'opacity-100 delay-300' : 'opacity-0'} text-2xl mx-auto`}>
            <div className='flex flex-col gap-2'>
              <div>
                <div className='text-center mb-5 text-3xl'>Кой ще се напомпа сега?</div>
                <input
                  type='text'
                  id='firstName'
                  className='w-full h-auto border border-black rounded-lg px-2 overflow-hidden'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete='off'
                />
              </div>
            </div>
          </div>
        </div>
        : <div className={`absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/2 transition-opacity duration-300 ${!isTopFiveView ? 'opacity-100 delay-300' : 'opacity-0'} flex flex-col items-center justify-center h-[50vh] text-center gap-2`}>
          <div className="mt-auto w-full max-w-full flex flex-col items-center justify-center">
            <span className="text-8xl break-words px-2 truncate max-w-[90vw] inline-block">{name.split(' ')[0].toUpperCase()}</span>
            <span className="text-5xl break-words px-2 truncate max-w-[90vw] inline-block">{name.split(' ').slice(1).join('').toUpperCase()}</span>
          </div>
          <div className="text-[12rem] flex justify-center w-full">
            <NumberFlow
              value={countRef.current}
              locales="en-US"
              format={{ useGrouping: false }}
              animated={true}
              className="pointer-events-none"
              willChange
            />
          </div>
          <div className="mb-auto select-none text-6xl flex justify-center w-full">
            <span className="inline-block">Лицеви</span>
          </div>

        </div>}

      <div
        className={`
          absolute z-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
          flex flex-col items-center justify-center h-[50vh] w-full text-center gap-2
          transition-all duration-700
          ${isTopFiveView ? 'opacity-100 scale-100 blur-0 pointer-events-auto' : 'opacity-0 scale-95 blur-sm pointer-events-none'}
        `}

      >

        <div className='text-8xl mt-1'>
          Топ 5
        </div>
        <div className="relative w-full flex flex-col items-center">
          <div className="w-full flex flex-col items-center transition-all duration-500"
            style={{
              minHeight: `${topFive.length * 3.5}rem`, // reserve space for smooth height changes
              transitionProperty: 'min-height'
            }}>
            {topFive.map((el, i) => {
              // Assign 'J' as the key for NumberFlow
              return (
                <div
                  key={el.firstName + (el.lastName ?? '')}
                  className={`
                text-4xl mt-2
                transition-all duration-500
                ${topFiveFetchAnimation
                      ? 'opacity-0 translate-x-10 blur-sm'
                      : 'opacity-100 translate-x-0 blur-0'
                    }
                `}
                  style={{
                    transitionDelay: `${i * 80}ms`
                  }}
                >
                  {i + 1}. {el.firstName} {el.lastName ? el.lastName : ''} - {el.count} лицеви
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  </div>
};

export default PushupsCounter;
