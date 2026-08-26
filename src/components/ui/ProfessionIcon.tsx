import ClassIcon from "./ClassIcon";

export default function ProfessionIcon({
  profession,
  className = "h-5 w-5",
}: {
  profession: string;
  className?: string;
}) {
  return <ClassIcon name={profession} className={className} />;
}
