import Link from 'next/link';

const Home = () => {
  return (
    <div className="w-screen h-screen flex">
      <div className="m-auto flex flex-col gap-6 items-center">
        <Link href="/push-ups-counter-pretty">
          <div className="text-9xl cursor-pointer">🦁</div>
        </Link>
      </div>
    </div>
  );
}

export default Home;
