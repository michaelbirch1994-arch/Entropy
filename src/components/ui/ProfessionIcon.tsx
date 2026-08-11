import ClassIcon from "./ClassIcon";

export default function ProfessionIcon({
  profession,
  className = "w-4 h-4",
}: {
  profession: string;
  className?: string;
}) {
  return <ClassIcon name={profession} className={className} />;
}
