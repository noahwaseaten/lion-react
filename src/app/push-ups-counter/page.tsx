'use client';
import { useState } from 'react';

enum Gender {
  Male = 'Male',
  Female = 'Female'
}

enum Type {
  Participant = 'Participant',
  Civilian = 'Civilian',
  Volunteer = 'Volunteer'
}

export type userInformation = {
  firstName: string,
  familyName: string,
  age: number,
  gender: Gender,
  type: Type,
  bib?: number, // if participant -> number, if other - '-'
  category?: string, // if participant -> category, if other - '-'
  phoneNumber?: string,
  notes?: string,
};

const PushupsCounter = () => {
  const [errors, setErrors] = useState<Map<keyof userInformation, boolean>>(
    new Map([
      ['firstName', false],
      ['familyName', false],
      ['age', false],
      ['gender', false],
      ['type', false],
      ['bib', false],
      ['category', false],
      ['phoneNumber', false],
      ['notes', false],
    ])
  );

  const updateError = (key: keyof userInformation, value: boolean) => {
    setErrors((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  };

  const [information, setInformation] = useState({
    firstName: '',
    familyName: '',
    age: '' as unknown,
    gender: 'Male',
    type: 'Participant',
    bib: '' as unknown, // if participant -> number, if other - '-'
    category: '', // if participant -> category, if other - '-'
    phoneNumber: '',
    notes: '',
  } as userInformation);

  const updateInformation = (key: keyof userInformation, value: unknown) => {
    setInformation(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleFormSubmission = () => {
    // const firstName = (document.getElementById('firstName') as HTMLInputElement).value;
    // const familyName = (document.getElementById('familyName') as HTMLInputElement).value;
    // const age = +(document.getElementById('age') as HTMLInputElement).value;
    // const bib = +(document.getElementById('bib') as HTMLInputElement).value;
    // const category = (document.getElementById('category') as HTMLInputElement).value;
    // const phoneNumber = (document.getElementById('phoneNumber') as HTMLInputElement).value;
    // const notes = (document.getElementById('notes') as HTMLInputElement).value;

    let exited = false;

    if (!information.firstName || !(/^[A-Za-z]+(?:[- ][A-Za-z]+)*$/.test(information.firstName))) {
      updateError('firstName', true);
      exited = true;
    } else {
      updateError('firstName', false);
    }

    if (!information.familyName) {
      updateError('familyName', true);
      exited = true;
    } else {
      updateError('familyName', false);
    }

    if (!information.age || information.age < 0 || information.age > 200) {
      updateError('age', true);
      exited = true;
    } else {
      updateError('age', false);
    }

    if (!information.gender || !Object.values(Gender).includes(information.gender as Gender)) {
      updateError('gender', true);
      exited = true;
    }

    if (!information.type || !Object.values(Type).includes(information.type as Type)) {
      updateError('type', true);
      exited = true;
    }

    // if (!bib) {
    //   updateError('bib', true);
    // }

    // if (!category) {
    //   updateError('category', true);
    // }

    // if (!phoneNumber) {
    //   updateError('phoneNumber', true);
    // }

    // if (!notes) {
    //   updateError('notes', true);
    // }

    if (exited) {
      return;
    }

    handleFinishSumbission();
  };

  const sendToGoogleSheet = async (data: userInformation) => {
    try {
      const res = await fetch('/api/sendInfoToGoogleSheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data,
        }),
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

  const handleFinishSumbission = async () => {
    await sendToGoogleSheet(information);
    setInformation({
    firstName: '',
    familyName: '',
    age: '' as unknown,
    gender: 'Male',
    type: 'Participant',
    bib: '' as unknown, // if participant -> number, if other - '-'
    category: '', // if participant -> category, if other - '-'
    phoneNumber: '',
    notes: '',
  } as userInformation);
  };

  // const TextInputSection = ({ title, id, required = false }: {
  //   title: string;
  //   id: keyof userInformation;
  //   required?: boolean;
  // }) => {
  //   return <div>
  //     <div>{title}{required && '*'}</div>
  //     <input
  //       type='text'
  //       id={id}
  //       className='w-full bg-[#0a0a0a]'
  //       value={information[id] != null ? String(information[id]) : ''}
  //       onChange={(e) => updateInformation(id, e.target.value)}
  //     />
  //     <div className={`text-sm text-red ${errors.get(id as keyof userInformation) ? 'block' : 'hidden'}`}>Error</div>
  //   </div>
  // };

  return <div className={`w-screen h-screen flex flex-col font-['Arial']`}>
    <div className='w-[40vw] mx-auto my-auto bg-zinc-900 py-10 rounded-xl'>
      <div>
        <div className='text-4xl text-center mb-4'>Person information</div>
        <div className='text-2xl w-1/2 mx-auto mb-10'>
          <div className='flex flex-col gap-2'>
            <div>
              <div>First Name*</div>
              <input
                type='text'
                id='firstName'
                className={`w-full bg-[#0a0a0a] rounded-lg px-2 ${errors.get('firstName') && 'border border-red-600'}`}
                value={information.firstName != null ? String(information.firstName) : ''}
                onChange={(e) => updateInformation('firstName', e.target.value)}
              />
              <div className={`text-sm text-red ${errors.get('firstName') ? 'block' : 'hidden'}`}>First name must not include any numbers or special characters</div>
            </div>
            <div>
              <div>Last Name*</div>
              <input
                type='text'
                id='familyName'
                className={`w-full bg-[#0a0a0a] rounded-lg px-2 ${errors.get('familyName') && 'border border-red-600'}`}
                value={information.familyName != null ? String(information.familyName) : ''}
                onChange={(e) => updateInformation('familyName', e.target.value)}
              />
              <div className={`text-sm text-red ${errors.get('familyName') ? 'block' : 'hidden'}`}>Last name must not include any numbers or special characters</div>
            </div>
            <div>
              <div>Age*</div>
              <input
                type='text'
                id='age'
                className={`w-full bg-[#0a0a0a] rounded-lg px-2 ${errors.get('age') && 'border border-red-600'}`}
                value={information.age != null ? String(information.age) : ''}
                onChange={(e) => updateInformation('age', e.target.value)}
              />
              <div className={`text-sm text-red ${errors.get('age') ? 'block' : 'hidden'}`}>Age must be a valid number</div>
            </div>
            <div>
              <div className=''>Gender*</div>
              <div className='flex'>
                <label className='mx-auto'><input type='radio' name='gender' value='male' checked={information.gender === 'Male'} className='=bg-[#0a0a0a]' onChange={() => updateInformation('gender', 'Male')} />Male</label>
                <label className='mx-auto'><input type='radio' name='gender' value='female' checked={information.gender === 'Female'} className='= bg-[#0a0a0a]' onChange={() => updateInformation('gender', 'Female')} />Female</label>
              </div>
            </div>
            <div>
              <div className=''>Person Standing*</div>
              <div className='flex'>
                <label className='mx-auto'><input type='radio' name='type' value='Participant' checked={information.type === 'Participant'} className='=bg-[#0a0a0a]' onChange={() => updateInformation('type', 'Participant')} />Participant</label>
                <label className='mx-auto'><input type='radio' name='type' value='Civilian' checked={information.type === 'Civilian'} className='= bg-[#0a0a0a]' onChange={() => updateInformation('type', 'Civilian')} />Civilian</label>
                <label className='mx-auto'><input type='radio' name='type' value='Volunteer' checked={information.type === 'Volunteer'} className='=bg-[#0a0a0a]' onChange={() => updateInformation('type', 'Volunteer')} />Volunteer</label>
              </div>
            </div>
            <div>
              <div>Bib Number</div>
              <input
                type='text'
                id='bib'
                className='w-full bg-[#0a0a0a]'
                value={information.bib != null ? String(information.bib) : ''}
                onChange={(e) => updateInformation('bib', e.target.value)}
              />
              <div className={`text-sm text-red ${errors.get('bib') ? 'block' : 'hidden'}`}>Error</div>
            </div>
            <div>
              <div>Category</div>
              <input
                type='text'
                id='category'
                className='w-full bg-[#0a0a0a]'
                value={information.category != null ? String(information.category) : ''}
                onChange={(e) => updateInformation('category', e.target.value)}
              />
              <div className={`text-sm text-red ${errors.get('category') ? 'block' : 'hidden'}`}>Error</div>
            </div>
            <div>
              <div>Phone Number</div>
              <input
                type='text'
                id='phoneNumber'
                className='w-full bg-[#0a0a0a]'
                value={information.phoneNumber != null ? String(information.phoneNumber) : ''}
                onChange={(e) => updateInformation('phoneNumber', e.target.value)}
              />
              <div className={`text-sm text-red ${errors.get('phoneNumber') ? 'block' : 'hidden'}`}>Error</div>
            </div>
            <div>
              <div>Notes</div>
              <input
                type='text'
                id='notes'
                className='w-full bg-[#0a0a0a]'
                value={information.notes != null ? String(information.notes) : ''}
                onChange={(e) => updateInformation('notes', e.target.value)}
              />
              <div className={`text-sm text-red ${errors.get('notes') ? 'block' : 'hidden'}`}>Error</div>
            </div>
          </div>
        </div>
        <div>
          <div className='w-min mx-auto text-2xl hover:cursor-pointer' onClick={() => handleFormSubmission()}>
            Submit
          </div>
        </div>
      </div>
    </div>
  </div>
};

export default PushupsCounter;
