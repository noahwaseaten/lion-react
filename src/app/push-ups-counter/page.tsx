'use client';
import { useState } from "react";

const PushupsCounter = () => {

  enum Gender {
    Male = "Male",
    Female = "Female"
  }

  enum Type {
    Participant = "Participant",
    Civilian = "Civilian",
    Volunteer = "Volunteer"
  }

  type userInformation = {
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

  const [errors, setErrors] = useState<Map<keyof userInformation, boolean>>(
    new Map([
      ["firstName", false],
      ["familyName", false],
      ["age", false],
      ["gender", false],
      ["type", false],
      ["bib", false],
      ["category", false],
      ["phoneNumber", false],
      ["notes", false],
    ])
  );

  const updateError = (key: keyof userInformation, value: boolean) => {
    setErrors((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  };

  const TextInputSection = ({ title, id, required = false }: {
    title: string;
    id: string;
    required?: boolean;
  }) => {
    return <div>
      <div>{title}{required && '*'}</div>
      <input type="text" id={id} className="w-full bg-[#0a0a0a]" />
      <div className={`text-sm text-red ${errors.get(id as keyof userInformation) ? 'block' : 'hidden'}`}>Error</div>
    </div>
  };

  const [information, setInformation] = useState({} as userInformation);
  const [gender, setGender] = useState('male');
  const [type, setType] = useState('Participant');
  const [count, setCount] = useState(0);

  const handleFormSubmission = () => {
    const firstName = (document.getElementById('firstName') as HTMLInputElement).value;
    const familyName = (document.getElementById('familyName') as HTMLInputElement).value;
    const age = +(document.getElementById('age') as HTMLInputElement).value;
    const bib = +(document.getElementById('bib') as HTMLInputElement).value;
    const category = (document.getElementById('category') as HTMLInputElement).value;
    const phoneNumber = (document.getElementById('phoneNumber') as HTMLInputElement).value;
    const notes = (document.getElementById('notes') as HTMLInputElement).value;

    setErrors(new Map([
      ["firstName", false],
      ["familyName", false],
      ["age", false],
      ["gender", false],
      ["type", false],
      ["bib", false],
      ["category", false],
      ["phoneNumber", false],
      ["notes", false],
    ]));

    if (!firstName) {
      updateError('firstName', true);
    }

    if (!familyName) {
      updateError('familyName', true);
    }

    if (!age) {
      updateError('age', true);
    }

    if (!gender || !Object.values(Gender).includes(gender as Gender)) {
      updateError('gender', true);
    }

    if (!type || !Object.values(Type).includes(type as Type)) {
      updateError('type', true);
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

    if (Array.from(errors.values()).some(value => value === true)) {
      return;
    }

    setInformation({
      firstName,
      familyName,
      age,
      gender: gender as Gender,
      type: type as Type,
      bib,
      category,
      phoneNumber,
      notes,
    });
  };

  const sendToGoogleSheet = async (data: userInformation) => {
  try {
    const res = await fetch("/api/sendToGoogleSheet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const contentType = res.headers.get("content-type");

    if (!res.ok) {
      // If it's JSON, try to parse the error
      if (contentType && contentType.includes("application/json")) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      } else {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errText}`);
      }
    }

    if (contentType && contentType.includes("application/json")) {
      const result = await res.json();
      console.log("Saved to Google Sheets:", result);
    } else {
      const text = await res.text();
      console.log("Received non-JSON response:", text);
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error("Error sending to Google Sheet:", err.message);
    } else {
      console.error("Unknown error:", err);
    }
  }
};

  const handleFinishSumbission = async () => {
    console.log({ ...information, count });
    await sendToGoogleSheet(information);
  };

  return <div className="w-screen h-screen flex flex-col">
    <div className="w-[40vw] mx-auto my-auto bg-zinc-900 py-10 rounded-xl">
      {information.firstName
        ? <div>
          <div className="text-4xl text-center mb-4">Person information</div>
          <div className="text-2xl w-1/2 mx-auto mb-10">
            <div className="flex flex-col gap-2">
              {[
                { title: 'First Name', id: 'firstName', required: true },
                { title: 'Last Name', id: 'familyName', required: true },
                { title: 'Age', id: 'age', required: true },
              ].map((el, i) => <TextInputSection key={i} title={el.title} id={el.id} required={el.required} />)}
              <div>
                <div className="">Gender*</div>
                <div className="flex">
                  <label className="mx-auto"><input type="radio" name="gender" value="male" checked={gender === "male"} className="=bg-[#0a0a0a]" onChange={() => setGender("male")} />Male</label>
                  <label className="mx-auto"><input type="radio" name="gender" value="female" checked={gender === "female"} className="= bg-[#0a0a0a]" onChange={() => setGender("female")} />Female</label>
                </div>
              </div>
              <div>
                <div className="">Person Standing*</div>
                <div className="flex">
                  <label className="mx-auto"><input type="radio" name="type" value="Participant" checked={type === "Participant"} className="=bg-[#0a0a0a]" onChange={() => setType("Participant")} />Participant</label>
                  <label className="mx-auto"><input type="radio" name="type" value="Civilian" checked={type === "Civilian"} className="= bg-[#0a0a0a]" onChange={() => setType("Civilian")} />Civilian</label>
                  <label className="mx-auto"><input type="radio" name="type" value="Volunteer" checked={type === "Volunteer"} className="=bg-[#0a0a0a]" onChange={() => setType("Volunteer")} />Volunteer</label>
                </div>
              </div>
              {[
                { title: 'Bib Number', id: 'bib', required: false },
                { title: 'Category', id: 'category', required: false },
                { title: 'Phone Number', id: 'phoneNumber', required: false },
                { title: 'Notes', id: 'notes', required: false },
              ].map((el, i) => <TextInputSection key={i} title={el.title} id={el.id} required={el.required} />)}
            </div>
          </div>
          <div>
            <div className="w-min mx-auto text-2xl hover:cursor-pointer" onClick={() => handleFormSubmission()}>
              Submit
            </div>
          </div>
        </div>
        : <div className="text-center text-2xl flex flex-col gap-2">
          <div>{count}</div>
          <div className="hover:cursor-pointer select-none" onClick={() => setCount(count + 1)}>Add push-up</div>
          <div className="hover:cursor-pointer select-none" onClick={() => handleFinishSumbission()}>Finish</div>
        </div>
      }
    </div>
  </div>
};

export default PushupsCounter;
