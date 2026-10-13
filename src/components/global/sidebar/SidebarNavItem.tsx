import { NavLink, useLocation } from "react-router-dom";
import { sidebarTokens as tokens } from "./sidebarTokens";

export type SidebarNavItem = {
  label: string;
  icon: React.ReactNode;
  link: string;
};

type Props = {
  item: SidebarNavItem;
  showLabel: boolean;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
};

export function SidebarNavItemView({
  item,
  showLabel,
  onOpenProfile,
  onOpenSettings,
}: Props) {
  const location = useLocation();

  if (item.link === "/profile") {
    return (
      <button
        type="button"
        onClick={onOpenProfile}
        draggable={false}
        aria-label={item.label}
        title={!showLabel ? item.label : undefined}
        className={`group relative flex h-10 w-full items-center rounded-xl px-2 text-base transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line/50 focus-visible:ring-offset-2 ${tokens.navItemIdle}`}
      >
        <span
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r opacity-0 transition-opacity duration-150"
          aria-hidden
        />
        <span className="flex h-9 w-9 items-center justify-center text-xl transition-transform duration-150 group-hover:translate-x-px">
          {item.icon}
        </span>
        <span
          className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-150 ${
            showLabel ? "ml-2 max-w-40 opacity-100" : "ml-0 max-w-0 opacity-0"
          }`}
        >
          {item.label}
        </span>
      </button>
    );
  }

  if (item.link === "/settings") {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        draggable={false}
        aria-label={item.label}
        title={!showLabel ? item.label : undefined}
        className={`group relative flex h-10 w-full items-center rounded-xl px-2 text-base transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line/50 focus-visible:ring-offset-2 ${tokens.navItemIdle}`}
      >
        <span
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r opacity-0 transition-opacity duration-150"
          aria-hidden
        />
        <span className="flex h-9 w-9 items-center justify-center text-xl transition-transform duration-150 group-hover:translate-x-px">
          {item.icon}
        </span>
        <span
          className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-150 ${
            showLabel ? "ml-2 max-w-40 opacity-100" : "ml-0 max-w-0 opacity-0"
          }`}
        >
          {item.label}
        </span>
      </button>
    );
  }

  const isActive =
    item.link === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(item.link);

  return (
    <NavLink
      to={item.link}
      draggable={false}
      aria-label={item.label}
      title={!showLabel ? item.label : undefined}
      className={`group relative flex h-10 font-mono items-center rounded-xl px-2 text-base transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line/50 focus-visible:ring-offset-2 ${
        isActive ? tokens.navItemActive : tokens.navItemIdle
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-r transition-all duration-500 ${
          isActive
            ? `${tokens.navAccent} translate-x-0 opacity-100`
            : "-translate-x-5 opacity-0"
        }`}
        aria-hidden
      />
      <span className="flex h-9 w-9 items-center justify-center text-xl transition-transform duration-150 group-hover:translate-x-px">
        {item.icon}
      </span>
      <span
        className={`overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-150 ${
          showLabel ? "ml-2 max-w-40 opacity-100" : "ml-0 max-w-0 opacity-0"
        }`}
      >
        {item.label}
      </span>
      {!showLabel && (
        <p
          className={`fixed -translate-x-12  group-hover:translate-x-16 bg-popover text-ink text-sm font-bold px-5 border border-line py-0.5 rounded-full font-sans duration-300 ease-in-out opacity-0 group-hover:opacity-100 `}
        >
          {item.label}
        </p>
      )}
    </NavLink>
  );
}
