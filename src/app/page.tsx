import CustomButton from "./components/customButton";

const Home = () => {
  return <div className="w-screen h-screen flex">
    <div className="m-auto flex flex-col gap-4">
      <div className="text-9xl mx-auto">🦁</div>
      <div className="text-center flex flex-col gap-3 ">
        <div className="text-4xl font-black">LION</div>
        <div className="">Unleash your inner strength in the Push Up Challenge</div>
        <CustomButton name='Push Up Counter' link='/push-ups-counter' />
        <CustomButton name='Push Up Counter Pretty' link='/push-ups-counter-pretty' />
      </div>
    </div>
  </div>
}

export default Home;
