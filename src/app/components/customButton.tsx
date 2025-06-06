import Link from "next/link"

const CustomButton = ({name, link}: {name: string, link: string}) => {
  return <Link
    href={link}
    className="bg-sky-500/75 px-2 py-1 font-semibold rounded-lg w-auto mx-auto hover:bg-sky-500/50 transition-all duration-250">
    {name}
  </Link>
};

export default CustomButton;
